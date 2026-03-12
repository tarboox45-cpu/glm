/**
 * X·Host Platform — Chat Streaming API
 * Serverless Function for Vercel
 * Proxies requests to GLM with nonce caching and session management
 */

let cachedNonce = null
let nonceTimestamp = 0
const NONCE_TTL = 60 * 60 * 1000 // 1 hour

// In-memory rate limiter (resets on cold start — acceptable for serverless)
const rateLimiter = new Map()
const RATE_LIMIT_MS = 800 // min ms between requests per IP

async function getNonce() {
  const now = Date.now()
  if (cachedNonce && (now - nonceTimestamp) < NONCE_TTL) return cachedNonce

  const res = await fetch('https://glm-ai.chat/chat/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ar,en;q=0.9'
    }
  })

  const html = await res.text()
  const match = html.match(/"nonce":"([^"]+)"/)
  if (!match) throw new Error('Could not retrieve authentication nonce')

  cachedNonce = match[1]
  nonceTimestamp = now
  return cachedNonce
}

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    'unknown'
  )
}

export default async function handler(req, res) {
  const API_KEY = process.env.API_KEY || 'x-host-jwgahs384babterboo'

  // ── Security headers
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // ── Auth
  const key = req.headers['x-api-key']
  if (key !== API_KEY) return res.status(401).json({ error: 'Invalid API key' })

  // ── Rate limiting
  const ip = getClientIp(req)
  const lastReq = rateLimiter.get(ip) || 0
  if (Date.now() - lastReq < RATE_LIMIT_MS) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' })
  }
  rateLimiter.set(ip, Date.now())

  // ── Parse body
  const { request, session_id = 'default', prompt = '', context = [] } = req.body || {}

  if (!request || typeof request !== 'string' || !request.trim()) {
    return res.status(400).json({ error: 'Field "request" is required and must be non-empty' })
  }

  if (request.length > 8000) {
    return res.status(400).json({ error: 'Request exceeds maximum length of 8000 characters' })
  }

  // ── Get nonce
  let nonce
  try {
    nonce = await getNonce()
  } catch (e) {
    return res.status(502).json({ error: 'AI service temporarily unavailable', detail: e.message })
  }

  // ── Build history from context array
  // context: [{ role: 'user'|'assistant', content: string }, ...]
  let history = '[]'
  if (prompt) {
    history = JSON.stringify([
      { role: 'user', content: prompt },
      { role: 'assistant', content: 'Understood. I will follow these instructions.' }
    ])
  } else if (Array.isArray(context) && context.length > 0) {
    // Take last 8 messages for context window management
    const trimmed = context.slice(-8)
    history = JSON.stringify(trimmed)
  }

  // ── Call GLM API
  const formData = new URLSearchParams()
  formData.append('action', 'glm_chat_stream')
  formData.append('nonce', nonce)
  formData.append('message', request)
  formData.append('history', history)
  formData.append('agent_mode', '1')

  let aiRes
  try {
    aiRes = await fetch('https://glm-ai.chat/wp-admin/admin-ajax.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `glm_session_id=guest_${session_id}`,
        'Origin': 'https://glm-ai.chat',
        'Referer': 'https://glm-ai.chat/chat/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: formData.toString()
    })
  } catch (e) {
    return res.status(502).json({ error: 'Failed to connect to AI service', detail: e.message })
  }

  if (!aiRes.ok) {
    return res.status(502).json({ error: `AI service error: ${aiRes.status}` })
  }

  // ── Stream response
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Transfer-Encoding': 'chunked'
  })

  const reader = aiRes.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let buf = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop()

      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const raw = line.slice(5).trim()

        if (raw === '[DONE]') {
          res.write(JSON.stringify({ type: 'finish', content: fullText }) + '\n')
          res.end()
          return
        }

        try {
          const parsed = JSON.parse(raw)
          const delta = parsed?.choices?.[0]?.delta
          if (!delta) continue

          if (delta.reasoning_content) {
            res.write(JSON.stringify({ type: 'thinking', content: delta.reasoning_content }) + '\n')
          }

          if (delta.content) {
            fullText += delta.content
            res.write(JSON.stringify({ type: 'response', content: delta.content }) + '\n')
          }
        } catch { /* skip malformed chunks */ }
      }
    }
  } catch (e) {
    res.write(JSON.stringify({ type: 'error', content: e.message }) + '\n')
  }

  res.end()
}
