/**
 * X·Host Platform — Content Analysis API
 * Handles: text file analysis, image description analysis, code review
 * Sends enriched prompts to GLM for intelligent analysis
 */

let cachedNonce = null
let nonceTimestamp = 0
const NONCE_TTL = 60 * 60 * 1000

async function getNonce() {
  const now = Date.now()
  if (cachedNonce && (now - nonceTimestamp) < NONCE_TTL) return cachedNonce

  const res = await fetch('https://glm-ai.chat/chat/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml'
    }
  })
  const html = await res.text()
  const match = html.match(/"nonce":"([^"]+)"/)
  if (!match) throw new Error('nonce not found')
  cachedNonce = match[1]
  nonceTimestamp = now
  return cachedNonce
}

/**
 * Build analysis prompt based on content type
 */
function buildAnalysisPrompt(type, content, instruction, fileName) {
  const name = fileName ? `"${fileName}"` : 'المحتوى'

  const prompts = {
    text: `أنت محلل محترف للنصوص والمستندات. قم بتحليل النص التالي من الملف ${name} وفق التعليمات التالية:

**التعليمات**: ${instruction || 'قم بتحليل هذا النص بشكل شامل: حدد الموضوع الرئيسي، النقاط المحورية، الأسلوب، واقترح تحسينات إن وجدت.'}

**المحتوى**:
\`\`\`
${content.slice(0, 4000)}
\`\`\`

قدّم تحليلاً منظماً ومفصلاً.`,

    code: `أنت مهندس برمجيات خبير. قم بمراجعة الكود التالي من الملف ${name}:

**المطلوب**: ${instruction || 'راجع الكود: حدد الأخطاء، المشاكل الأمنية، فرص التحسين، وقترح أفضل الممارسات.'}

**الكود**:
\`\`\`
${content.slice(0, 4000)}
\`\`\`

قدّم مراجعة تقنية احترافية منظمة بعناوين واضحة.`,

    image: `أنت محلل صور ومحتوى بصري محترف. المستخدم رفع صورة ${name ? `باسم ${name}` : ''} وأرسل لك بياناتها الوصفية.

**معلومات الصورة المستخرجة**:
${content}

**طلب المستخدم**: ${instruction || 'حلل محتوى هذه الصورة بالتفصيل: ماذا تُظهر؟ ما المعنى أو الغرض منها؟ ما التفاصيل اللافتة؟ هل هناك أي نصوص أو أرقام مرئية؟'}

قدّم تحليلاً شاملاً ومنظماً للصورة.`,

    csv: `أنت محلل بيانات محترف. قم بتحليل البيانات التالية من الملف ${name}:

**المطلوب**: ${instruction || 'حلل هذه البيانات: استخرج الأنماط، الإحصاءات الرئيسية، الشذوذات، وقدم رؤى قابلة للتنفيذ.'}

**البيانات** (أول 50 سجل):
\`\`\`
${content.slice(0, 3000)}
\`\`\`

قدّم تحليلاً بيانياً منظماً مع جداول وأرقام.`,

    json: `أنت مهندس بيانات وAPI. قم بتحليل بنية JSON التالية من ${name}:

**المطلوب**: ${instruction || 'حلل هذا الكائن: وصف البنية، المفاتيح الرئيسية، نوع البيانات، الاستخدام المحتمل، واقترح تحسينات.'}

**البيانات**:
\`\`\`json
${content.slice(0, 3000)}
\`\`\`

قدّم تحليلاً تقنياً واضحاً.`
  }

  return prompts[type] || prompts.text
}

export default async function handler(req, res) {
  const API_KEY = process.env.API_KEY || 'x-host-jwgahs384babterboo'

  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const key = req.headers['x-api-key']
  if (key !== API_KEY) return res.status(401).json({ error: 'Invalid API key' })

  const {
    type = 'text',      // 'text' | 'code' | 'image' | 'csv' | 'json'
    content = '',       // file content or image metadata string
    instruction = '',   // user's specific analysis request
    fileName = '',      // original file name
    session_id = 'analysis'
  } = req.body || {}

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' })
  }

  const message = buildAnalysisPrompt(type, content, instruction, fileName)

  let nonce
  try {
    nonce = await getNonce()
  } catch (e) {
    return res.status(502).json({ error: 'AI service unavailable' })
  }

  // System prompt: expert analyst persona
  const systemHistory = JSON.stringify([
    {
      role: 'user',
      content: 'أنت محلل متخصص ومتعدد التخصصات. تقدم تحليلات دقيقة ومنظمة بالعربية، مع استخدام التنسيق الجيد والعناوين الواضحة.'
    },
    {
      role: 'assistant',
      content: 'نعم، أنا محلل متخصص. سأقدم تحليلات احترافية منظمة وشاملة.'
    }
  ])

  const formData = new URLSearchParams()
  formData.append('action', 'glm_chat_stream')
  formData.append('nonce', nonce)
  formData.append('message', message)
  formData.append('history', systemHistory)
  formData.append('agent_mode', '1')

  const aiRes = await fetch('https://glm-ai.chat/wp-admin/admin-ajax.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': `glm_session_id=guest_${session_id}`,
      'Origin': 'https://glm-ai.chat',
      'Referer': 'https://glm-ai.chat/chat/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: formData.toString()
  }).catch(e => { throw new Error(`Network error: ${e.message}`) })

  if (!aiRes.ok) return res.status(502).json({ error: `AI service error: ${aiRes.status}` })

  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache'
  })

  const reader = aiRes.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let buf = ''

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
        if (delta?.content) {
          fullText += delta.content
          res.write(JSON.stringify({ type: 'response', content: delta.content }) + '\n')
        }
      } catch { }
    }
  }
  res.end()
}
