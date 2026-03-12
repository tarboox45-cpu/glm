# X·Host Chat — التقرير التقني الشامل

## نظرة عامة

**X·Host Chat** هو موقع ويب متكامل للدردشة بالذكاء الاصطناعي، مبني على نموذج GLM المتقدم. تم تصميمه وتطويره ليكون جاهزاً للنشر الفوري على منصة Vercel مع واجهة مستخدم احترافية وأداء عالٍ.

---

## هيكل المشروع

```
x-host-chat/
├── api/
│   └── chat.js          ← Serverless Function (API الخلفي)
├── public/
│   └── index.html       ← واجهة المستخدم الكاملة (SPA)
├── vercel.json          ← إعدادات النشر على Vercel
├── package.json         ← تعريف المشروع والاعتمادات
├── .gitignore           ← استثناءات Git
└── README.md            ← هذا الملف
```

---

## التقنيات المستخدمة

| الطبقة | التقنية | السبب |
|--------|---------|-------|
| **Backend** | Vercel Serverless Functions (Node.js) | صفر إعداد، توسع تلقائي، Vercel-native |
| **Frontend** | HTML5 + CSS3 + Vanilla JS | بدون build step، سرعة تحميل فائقة، متوافق مع كل المتصفحات |
| **AI Model** | GLM (عبر glm-ai.chat) | النموذج المدمج في المشروع الأصلي |
| **Streaming** | ReadableStream API (NDJSON) | استجابات فورية بدون انتظار |
| **التخزين** | localStorage | حفظ المحادثات والإعدادات محلياً |
| **الخطوط** | IBM Plex Sans Arabic | دعم ممتاز للعربية، مظهر احترافي |

---

## آلية عمل API

### نقطة النهاية (Endpoint)

```
POST /api/chat
GET  /api/chat
```

### المصادقة

```http
x-api-key: x-host-jwgahs384babterboo
```

### معاملات الطلب

| المعامل | النوع | الوصف |
|---------|-------|-------|
| `request` | string (مطلوب) | نص رسالة المستخدم |
| `session_id` | string | معرّف الجلسة (افتراضي: `"default"`) |
| `prompt` | string | رسالة النظام (System Prompt) |

### مثال على الطلب

```bash
curl -X POST https://your-domain.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: x-host-jwgahs384babterboo" \
  -d '{
    "request": "ما هو الذكاء الاصطناعي؟",
    "session_id": "user123",
    "prompt": "أنت مساعد ذكي باللغة العربية"
  }'
```

### تنسيق الاستجابة (Streaming NDJSON)

تُعاد الاستجابة كخط إنتاج متدفق (stream)، كل سطر كائن JSON:

```json
{"type": "thinking", "content": "...تفكير النموذج..."}
{"type": "response", "content": "...جزء من الرد..."}
{"type": "finish",   "content": "...النص الكامل..."}
```

| النوع | الوصف |
|-------|-------|
| `thinking` | مرحلة تفكير النموذج الداخلية (قابلة للعرض/الإخفاء) |
| `response` | أجزاء الرد المتدفقة تباعاً |
| `finish` | إشارة انتهاء مع النص الكامل للرد |

---

## ميزات الواجهة الأمامية

### ✅ ميزات الدردشة
- **Streaming في الوقت الفعلي** — تظهر الكلمات أولاً بأول كما يكتبها النموذج
- **عرض التفكير** — كتلة قابلة للطي تُظهر عملية التفكير الداخلية للنموذج
- **تاريخ المحادثات** — يُحفظ تلقائياً في localStorage
- **محادثات متعددة** — يمكن إنشاء محادثات متوازية والتنقل بينها
- **إيقاف البث** — زر الإرسال يتحول لزر إيقاف أثناء التدفق

### ✅ تجربة المستخدم
- **Responsive Design** — يعمل على الهاتف، التابلت، والحاسوب
- **مؤشر الحالة** — نقطة ملونة تُظهر حالة الاتصال (متصل/يفكر/خطأ)
- **اقتراحات البداية** — أسئلة جاهزة للمستخدمين الجدد
- **اختصارات لوحة المفاتيح** — Enter للإرسال، Shift+Enter لسطر جديد
- **عداد الأحرف** — يُظهر عدد أحرف الرسالة الحالية
- **Auto-resize** — صندوق النص يتمدد تلقائياً مع المحتوى

### ✅ الإعدادات
- تغيير مفتاح API
- تخصيص System Prompt
- تغيير معرّف الجلسة
- الحفظ التلقائي في localStorage

---

## إعدادات Vercel

### `vercel.json` — شرح الإعدادات

```json
{
  "functions": {
    "api/chat.js": {
      "maxDuration": 60    // الحد الأقصى للزمن: 60 ثانية (ضروري لنماذج LLM)
    }
  },
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/$1" },     // API routes
    { "src": "/(.*)",     "dest": "/public/$1" }   // Static files
  ],
  "headers": [...]   // Security headers
}
```

---

## النشر على Vercel

### الطريقة 1: عبر Vercel CLI

```bash
# 1. تثبيت Vercel CLI
npm i -g vercel

# 2. الدخول لحسابك
vercel login

# 3. نشر المشروع
cd x-host-chat
vercel --prod
```

### الطريقة 2: عبر GitHub + Vercel Dashboard

1. ارفع المشروع على GitHub
2. اذهب إلى [vercel.com](https://vercel.com) → New Project
3. اختر المستودع
4. Vercel يكتشف الإعدادات تلقائياً (**لا توجد إعدادات إضافية مطلوبة**)
5. اضغط Deploy

### الطريقة 3: سحب وإفلات

1. اذهب إلى vercel.com → New Project
2. اسحب مجلد `x-host-chat` وأفلته مباشرة

---

## الأمان

| الإجراء | التفاصيل |
|---------|---------|
| **API Key Auth** | كل طلب يجب أن يحمل `x-api-key` صحيحاً |
| **CORS** | مضبوط للسماح بالوصول العام (قابل للتقييد) |
| **Security Headers** | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` |
| **No Secrets Exposure** | مفتاح API لا يُعرض في الواجهة الأمامية (مخزن في localStorage فقط) |

---

## الأداء

- **لا يوجد Build Step** — نشر فوري، لا Webpack، لا bundling
- **Static HTML** — يُقدَّم من CDN Vercel بزمن استجابة < 50ms
- **Nonce Caching** — يُخزَّن الـ nonce لمدة ساعة لتقليل الطلبات الإضافية
- **Streaming** — لا انتظار لاكتمال الرد، يظهر فورياً

---

## نصائح الصيانة المستقبلية

1. **تدوير مفتاح API** — يمكن تغييره من `api/chat.js` في السطر:
   ```js
   const API_KEY = "x-host-jwgahs384babterboo"
   ```

2. **Rate Limiting** — لإضافة حماية من الإفراط في الاستخدام:
   ```js
   // في api/chat.js أضف في البداية:
   const rateMap = new Map()
   const ip = req.headers['x-forwarded-for'] || 'unknown'
   const now = Date.now()
   const last = rateMap.get(ip) || 0
   if (now - last < 1000) return res.status(429).json({ error: 'Too many requests' })
   rateMap.set(ip, now)
   ```

3. **تغيير النموذج** — إذا تغير عنوان `glm-ai.chat`، عدّل في `api/chat.js`:
   ```js
   const res = await fetch("https://glm-ai.chat/chat/", ...)
   const ai = await fetch("https://glm-ai.chat/wp-admin/admin-ajax.php", ...)
   ```

4. **إضافة Analytics** — أضف `vercel analytics` لتتبع الاستخدام:
   ```bash
   npm i @vercel/analytics
   ```

---

## المتطلبات

- Node.js >= 18
- حساب Vercel (مجاني يكفي للاستخدام الشخصي)
- لا توجد متطلبات قاعدة بيانات أو خوادم خارجية

---

## الترخيص

MIT License — حر الاستخدام والتعديل.

---

*X·Host Chat — Built with precision for Vercel deployment.*
