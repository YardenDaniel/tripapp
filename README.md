# 🏯 TripApp - העוזרת האישית לטיול

אפליקציה אישית לתיעוד וניהול טיולים, עם דגש על חוויה משותפת לזוגות מטיילים.

## ✨ הפיצ'רים

- 🗺️ **מפת זכרונות חיה** - תמונות נעצים אוטומטית על המפה לפי GPS
- 📅 **יומן מסע** - תכנון יומי מפורט של פעילויות, אוכל, לינה ואטרקציות
- 🤖 **עוזר חכם (Claude AI)** - שואל שאלות על מקומות, ממליץ ומוסיף ללו"ז
- 💱 **ממיר מטבע** - שערים בזמן אמת
- 🆘 **מספרי חירום** - מותאמים לכל מדינה
- 👥 **שיתוף בין מטיילים** - סנכרון בזמן אמת
- 📱 **PWA** - התקנה על הטלפון, עובד גם offline

## 🛠️ הסטאק הטכנולוגי

- **Frontend:** React 18 + Vite + TailwindCSS
- **Backend:** Supabase (PostgreSQL + PostGIS + Auth + Storage + Realtime)
- **Maps:** Mapbox GL JS + react-map-gl
- **AI:** Anthropic Claude API
- **PWA:** vite-plugin-pwa

## 🚀 הקמה מאפס - הוראות מפורטות

### שלב 1: Supabase (Database + Backend)

1. לכי ל-[supabase.com](https://supabase.com) ופתחי חשבון חינמי
2. צרי פרויקט חדש (לחצי "New Project")
   - בחרי שם: `tripapp`
   - בחרי סיסמה חזקה ל-DB (תשמרי אותה!)
   - בחרי region: `Europe (Frankfurt)` או הקרוב אלייך
3. כשהפרויקט מוכן, לכי ל-**SQL Editor** (אייקון בצד שמאל)
4. העתיקי את כל התוכן של הקובץ `supabase/schema.sql`
5. הדביקי ב-SQL Editor ולחצי **Run** ▶️

   זה יוצר את כל הטבלאות, ה-RLS policies, וטריגרים אוטומטיים.

6. צרי 3 Storage Buckets:
   - לכי ל-**Storage** (אייקון בצד שמאל)
   - לחצי "New bucket" וצרי:
     - `memories` — סמני **Public** ✓
     - `avatars` — סמני **Public** ✓
     - `trip-covers` — סמני **Public** ✓

7. קחי את המפתחות:
   - לכי ל-**Settings → API**
   - העתיקי את `Project URL` ואת `anon public` key

### שלב 2: Mapbox (מפות)

1. לכי ל-[mapbox.com](https://mapbox.com) ופתחי חשבון חינמי
2. אחרי האישור, לכי ל-**Account → Tokens**
3. העתיקי את `Default public token` (מתחיל ב-`pk.`)

### שלב 3: Anthropic API (עוזר AI)

1. לכי ל-[console.anthropic.com](https://console.anthropic.com)
2. הרשמי וקני קרדיט מינימלי ($5 מספיקים לטיול שלם)
3. לכי ל-**API Keys** וצרי מפתח חדש
4. העתיקי את המפתח (מתחיל ב-`sk-ant-`)

### שלב 4: התקנה מקומית

```bash
# שכפלי את הפרויקט
cd tripapp

# התקיני dependencies
npm install

# צרי קובץ .env.local
cp .env.example .env.local
```

ערכי את `.env.local` עם המפתחות שאספת:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
VITE_MAPBOX_TOKEN=pk.eyJ1...
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

### שלב 5: הרצה

```bash
npm run dev
```

האפליקציה תרוץ על http://localhost:5173

### שלב 6: שימוש בטלפון בזמן הטיול

**אופציה א' - דפלוי ל-Vercel (מומלץ):**

1. דחפי את הקוד ל-GitHub repo
2. לכי ל-[vercel.com](https://vercel.com) והתחברי עם GitHub
3. Import את ה-repo
4. הוסיפי את משתני הסביבה (אותם 4 מפתחות)
5. Deploy
6. תקבלי URL ציבורי כמו `tripapp-xyz.vercel.app`
7. בטלפון, פתחי את ה-URL בדפדפן והוסיפי למסך הבית (PWA)

**אופציה ב' - הרצה מהמחשב באותה רשת:**

```bash
npm run dev -- --host
```

זה יציג URL כמו `http://192.168.1.5:5173` שתוכלי לפתוח בטלפון, כל עוד אתם באותה רשת WiFi.

## 📱 שימוש כמו אפליקציה (PWA)

באייפון: פתחי את האתר ב-Safari → "שתף" → "הוסף למסך הבית"
באנדרואיד: פתחי בכרום → תפריט → "הוסף למסך הבית"

## 🤝 איך משתפים עם בן/בת זוג

1. שניכם נרשמים לאפליקציה (כל אחד עם המייל שלו)
2. את (יוצרת הטיול) הולכת לטאב **מטיילים**
3. לחצי "הזמיני מטיילת/מטייל" והוסיפי את האימייל של בן הזוג
4. עכשיו שניכם רואים ועורכים את אותו הטיול בזמן אמת

## 🐛 פתרון בעיות

**"חסרים משתני סביבה"** — בדקי שיש לך `.env.local` עם כל 4 המפתחות

**מפה לא נטענת** — בדקי שה-Mapbox token תקף ב-mapbox.com

**העלאת תמונות נכשלת** — ודאי שיצרת את ה-bucket `memories` עם Public

**העוזר AI לא עונה** — בדקי שיש קרדיט בחשבון Anthropic ושהמפתח נכון

## 🔒 אבטחה

- **Row Level Security (RLS)** מופעל על כל הטבלאות
- כל משתמש רואה רק טיולים שהוא חבר בהם
- API keys מאוחסנים ב-`.env.local` (לא נכנסים ל-git)

## 📐 ארכיטקטורה

```
┌─────────────────┐
│  React Client   │ ← PWA, Tailwind, Mapbox
│   (Frontend)    │
└────────┬────────┘
         │
    ┌────┴─────┐
    │          │
┌───▼────┐ ┌───▼────────┐
│Supabase│ │Anthropic   │
│        │ │Claude API  │
│ • Auth │ └────────────┘
│ • DB   │
│ • Stor │
│ • RT   │
└────────┘
```

## 📝 רישיון

פרויקט אישי. השתמשי בחופשיות לטיול שלך.
