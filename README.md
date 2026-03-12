# X·Host Platform v2.0 — التقرير التقني الشامل

## نظرة عامة على المنصة

**X·Host Platform** هي منصة ذكاء اصطناعي متكاملة تجمع بين ثلاث وحدات وظيفية رئيسية:
- **💬 الدردشة الذكية** — محادثات تفاعلية مع نموذج GLM بدعم Streaming كامل
- **📝 محرر الملفات** — تحرير الملفات البرمجية والنصية مع تحليل AI مدمج
- **🖼 محلل الصور** — رفع الصور وتحليلها باستخدام الذكاء الاصطناعي

---

## هيكل المشروع

```
x-host-platform/
├── api/
│   ├── chat.js        ← Serverless: بث محادثات GLM بشكل متدفق
│   └── analyze.js     ← Serverless: تحليل الملفات والصور
├── public/
│   └── index.html     ← SPA الكاملة (HTML + CSS + JS في ملف واحد)
├── vercel.json        ← إعدادات توجيه Vercel، Headers الأمان، البيئة
├── package.json       ← تعريف المشروع
├── .gitignore
└── README.md          ← هذا الملف
```

---

## الوحدات التقنية

### 1. API الدردشة (`/api/chat`)

**الغرض:** بث ردود GLM بشكل متدفق (Streaming) مع دعم سياق المحادثة.

**الميزات الجديدة مقارنة بالنسخة الأصلية:**

| الميزة | التفاصيل |
|--------|---------|
| **Context Window** | يُرسل آخر 6 رسائل كسياق مع كل طلب |
| **Rate Limiting** | حماية من إساءة الاستخدام (800ms بين الطلبات) |
| **IP Detection** | استخراج IP من `x-forwarded-for` للـ Rate Limiting |
| **Input Validation** | التحقق من الطول (8000 حرف كحد أقصى) والنوع |
| **Error Taxonomy** | تصنيف الأخطاء: `502` للـ upstream، `400` للمدخلات، `429` للـ Rate Limit |
| **Nonce Caching** | تخزين Nonce مؤقتاً لمدة ساعة |

**طلب POST `/api/chat`:**
```json
{
  "request":    "نص رسالة المستخدم",
  "session_id": "user-abc",
  "prompt":     "System prompt اختياري",
  "context":    [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
}
```

**استجابة Stream (NDJSON):**
```
{"type": "thinking",  "content": "...تفكير داخلي..."}
{"type": "response",  "content": "...جزء من الرد..."}
{"type": "finish",    "content": "...النص الكامل..."}
```

---

### 2. API التحليل (`/api/analyze`)

**الغرض:** تحليل محتوى الملفات والصور بإرسال بيانات غنية إلى GLM.

**أنواع التحليل المدعومة:**

| النوع (`type`) | الوصف | مثال استخدام |
|--------------|-------|-------------|
| `code` | مراجعة الكود، الأمان، الأداء | `.js`, `.py`, `.ts` |
| `text` | تحليل النصوص والمستندات | `.md`, `.txt` |
| `json` | تحليل بنية JSON والـ API | `.json` |
| `csv` | تحليل البيانات والأنماط | `.csv` |
| `image` | تحليل الصور من البيانات الوصفية | `PNG`, `JPEG`, `WebP` |

**طلب POST `/api/analyze`:**
```json
{
  "type":        "code",
  "content":     "محتوى الملف أو البيانات الوصفية",
  "instruction": "ماذا تريد من AI؟ (اختياري)",
  "fileName":    "app.js",
  "session_id":  "editor"
}
```

---

### 3. الواجهة الأمامية (`/public/index.html`)

SPA مكتفية ذاتياً — لا تعتمد على أي Framework خارجي أو Build Process.

**النظام المعماري:**

```
shell (CSS Grid)
├── topbar (header دائم)
├── nav (sidebar بالمحادثات والوحدات)
└── content (منطقة المحتوى الرئيسية)
    ├── mod-chat     (الدردشة)
    ├── mod-editor   (محرر الملفات)
    ├── mod-image    (محلل الصور)
    └── mod-settings (الإعدادات)
```

**إدارة الحالة (State Management):**
```javascript
app = {
  module: 'chat',           // الوحدة النشطة
  streaming: false,         // هل هناك طلب جاري؟
  abort: AbortController,   // للإلغاء عند الحاجة
  conversations: [...],     // سجل كل المحادثات
  activeConvId: string,     // المحادثة الحالية
  settings: { ... },        // تفضيلات المستخدم
  editor: { files, activeId, ... },  // حالة المحرر
  image: { file, dataUrl, meta }     // حالة محلل الصور
}
```

**التخزين المحلي:**
- `xhp_settings` — إعدادات المستخدم
- `xhp_convs` — سجل المحادثات

---

## ميزات كل وحدة

### 💬 وحدة الدردشة

- **Streaming في الوقت الفعلي** — كلمة بكلمة
- **عرض التفكير الداخلي** — كتلة قابلة للطي تُظهر مرحلة Reasoning
- **Context Memory** — إرسال سياق المحادثة السابقة تلقائياً
- **محادثات متعددة** — تنقل سهل في الشريط الجانبي
- **تصدير المحادثة** — تصدير كملف نصي
- **اقتراحات ذكية** — بطاقات بداية سريعة

### 📝 وحدة المحرر

- **فتح ملفات متعددة** — نظام tabs للتنقل بين الملفات
- **كشف نوع الملف تلقائياً** — يُحدد طريقة التحليل حسب الامتداد
- **تحليل AI بـ Streaming** — النتيجة تظهر فورياً
- **إدراج التحليل في الملف** — زر "تطبيق" يُضيف التحليل كتعليق
- **حفظ الملف محلياً** — تنزيل فوري
- **شريط معلومات** — السطور، الأحرف، نوع الملف

### 🖼 وحدة محلل الصور

- **Drag & Drop** — سحب وإفلات الصور مباشرة
- **معاينة فورية** — عرض الصورة قبل التحليل
- **استخراج البيانات الوصفية** — الأبعاد، النوع، الحجم، الاسم
- **تحليل قابل للتخصيص** — توجيه AI بتعليمات محددة
- **دعم صيغ متعددة** — PNG, JPEG, WebP, GIF, SVG, BMP

### ⚙ الإعدادات

- **API Key** — تغيير مفتاح المصادقة
- **System Prompt** — تخصيص شخصية النموذج
- **معرّف الجلسة** — إدارة سياق GLM
- **تفضيلات الواجهة** — عرض التفكير، الحفظ التلقائي، اختصار Enter
- **إحصائيات** — عدد المحادثات والرسائل
- **مسح البيانات** — حذف كل البيانات المحلية

---

## متطلبات النشر على Vercel

### الإعداد الفوري (Zero-Config)

لا توجد متطلبات إضافية — Vercel يكتشف الـ Serverless Functions تلقائياً.

### خطوات النشر

**الطريقة 1 — Vercel CLI:**
```bash
npm install -g vercel
vercel login
cd x-host-platform
vercel --prod
```

**الطريقة 2 — GitHub Integration:**
1. ارفع المجلد على GitHub
2. [vercel.com](https://vercel.com) → New Project → Import Git Repository
3. اضغط Deploy — لا شيء آخر مطلوب

**الطريقة 3 — Drag & Drop:**
اسحب مجلد `x-host-platform` وأفلته في [vercel.com/new](https://vercel.com/new)

### متغيرات البيئة (اختياري)

لتعزيز الأمان، يمكن تغيير API Key عبر Vercel Dashboard:
```
Settings → Environment Variables → Add:
Name:  API_KEY
Value: مفتاحك-الجديد
```

ثم في `api/chat.js` و `api/analyze.js`:
```javascript
const API_KEY = process.env.API_KEY || 'x-host-jwgahs384babterboo'
```

---

## الأمان

| الإجراء | التفاصيل |
|---------|---------|
| **API Key Auth** | كل طلب يحتاج `x-api-key` صحيح في الـ Header |
| **Rate Limiting** | 800ms minimum بين الطلبات من نفس IP |
| **Input Sanitization** | التحقق من نوع وطول المدخلات |
| **Security Headers** | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` |
| **CORS** | مضبوط، قابل للتقييد عبر `ALLOWED_ORIGIN` env var |
| **No Secrets in Frontend** | مفتاح API يُخزن فقط في localStorage المتصفح |
| **Max Request Size** | 8000 حرف كحد أقصى للرسائل |

---

## الأداء

| المقياس | القيمة المتوقعة |
|--------|--------------|
| زمن تحميل الصفحة | < 300ms (CDN Vercel) |
| أول بايت من الـ Stream | ~800ms - 2s |
| حجم `index.html` | ~55KB |
| Build Time | لا يوجد (Static HTML) |
| Cold Start الـ Serverless | ~300-500ms |

**لماذا لا يوجد Build Step؟**
- السرعة: نشر فوري بدون webpack/vite/rollup
- البساطة: ملف HTML واحد يحتوي كل شيء
- Vercel CDN: يُقدّم الـ HTML من edge network عالمياً

---

## التطوير المحلي

```bash
npm install -g vercel
cd x-host-platform
vercel dev
# الموقع يعمل على http://localhost:3000
```

---

## توسيع المنصة مستقبلاً

### إضافة وحدة جديدة
```javascript
// 1. أضف nav-item في HTML
// 2. أضف module section في HTML
// 3. أضف case في switchModule()
// 4. أضف منطق JavaScript للوحدة
```

### تحسين تحليل الصور
عند توفر API يدعم Vision (مثل GPT-4V):
```javascript
// في api/analyze.js، أضف دعم base64
const imageContent = [{
  type: "image_url",
  image_url: { url: `data:image/jpeg;base64,${base64Data}` }
}]
```

### إضافة قاعدة بيانات
لتخزين المحادثات server-side (بدلاً من localStorage):
```javascript
// في vercel.json أضف:
// "integrations": ["vercel-postgres"]
// أو استخدم Vercel KV للـ key-value storage
```

---

## استكشاف المشاكل

| المشكلة | السبب المحتمل | الحل |
|---------|-------------|------|
| خطأ 401 | API Key غلط | تحقق من الإعدادات |
| خطأ 502 | خدمة GLM غير متاحة | انتظر وأعد المحاولة |
| خطأ 429 | طلبات كثيرة | انتظر ثانية بين الطلبات |
| الـ Stream يتوقف | مهلة Vercel (60s) | رسائل أقصر |
| لا تظهر الصورة | حجم كبير | استخدم صور أقل من 5MB |

---

*X·Host Platform v2.0 — Built for Vercel Serverless. Zero dependencies. Maximum performance.*
