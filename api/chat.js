const sessions = new Map()

let cachedNonce = null
let nonceTimestamp = 0
const NONCE_TTL = 60 * 60 * 1000

async function getNonce() {
  const now = Date.now()
  if (cachedNonce && (now - nonceTimestamp) < NONCE_TTL) {
    return cachedNonce
  }
  const res = await fetch("https://glm-ai.chat/chat/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml"
    }
  })
  const html = await res.text()
  const match = html.match(/"nonce":"([^"]+)"/)
  if (!match) throw new Error("nonce not found")
  cachedNonce = match[1]
  nonceTimestamp = now
  return cachedNonce
}

export default async function handler(req, res) {
  const API_KEY = "x-host-jwgahs384babterboo"

  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-api-key")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  let request = ""
  let session_id = "default"
  let prompt = ""

  if (req.method === "GET") {
    request = req.query.request
    session_id = req.query.session_id || "default"
    prompt = req.query.prompt || ""
  }

  if (req.method === "POST") {
    request = req.body.request
    session_id = req.body.session_id || "default"
    prompt = req.body.prompt || ""
  }

  const key = req.headers["x-api-key"] || req.query.api_key

  if (key !== API_KEY) {
    return res.status(401).json({ error: "Invalid API key" })
  }

  if (!request) {
    return res.status(400).json({ error: "request required" })
  }

  let nonce
  try {
    nonce = await getNonce()
  } catch (e) {
    return res.status(500).json({ error: "Failed to get nonce" })
  }

  const history = prompt
    ? JSON.stringify([{ role: "user", content: prompt }, { role: "assistant", content: "." }])
    : "[]"

  const formData = new URLSearchParams()
  formData.append("action", "glm_chat_stream")
  formData.append("nonce", nonce)
  formData.append("message", request)
  formData.append("history", history)
  formData.append("agent_mode", "1")

  const ai = await fetch("https://glm-ai.chat/wp-admin/admin-ajax.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": `glm_session_id=guest_${session_id}`,
      "Origin": "https://glm-ai.chat",
      "Referer": "https://glm-ai.chat/chat/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    },
    body: formData.toString()
  })

  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  })

  const reader = ai.body.getReader()
  const decoder = new TextDecoder()
  let full = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split("\n")

    for (const line of lines) {
      if (!line.startsWith("data:")) continue
      const json = line.replace("data:", "").trim()

      if (json === "[DONE]") {
        res.write(JSON.stringify({ type: "finish", content: full }) + "\n")
        res.end()
        return
      }

      try {
        const parsed = JSON.parse(json)
        const delta = parsed?.choices?.[0]?.delta
        if (!delta) continue

        if (delta.reasoning_content) {
          res.write(JSON.stringify({ type: "thinking", content: delta.reasoning_content }) + "\n")
        }

        if (delta.content) {
          full += delta.content
          res.write(JSON.stringify({ type: "response", content: delta.content }) + "\n")
        }
      } catch {}
    }
  }

  res.end()
}
