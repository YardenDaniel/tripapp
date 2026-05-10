# TripApp

A collaborative trip-planning Progressive Web App for travelers who want everything in one place: itinerary, photo map, packing list, AI travel assistant, currency converter, emergency numbers, and real-time sync with co-travelers.

**Live:** [tripapp-one.vercel.app](https://tripapp-one.vercel.app)

---

## Features

- **Schedule** — daily itinerary with activities (food, stay, flight, train, hike, beach, and more), locations, times, and notes
- **Memory Map** — drop photos on a Mapbox map; GPS pulled automatically from EXIF data
- **Packing list** — shared checklist per trip with realtime sync between co-travelers
- **AI Assistant** — chat with Claude about restaurants, attractions, transport, customs (proxied through a Supabase Edge Function so the API key stays server-side)
- **Currency** — live exchange rates for 70+ currencies, defaults adapted to the trip's country
- **Emergency** — police / ambulance / fire numbers auto-loaded for the trip's country (94 countries)
- **Travelers** — invite friends by shareable link (WhatsApp-friendly) or by email
- **PWA** — installable to the home screen on iOS and Android, works on shaky hotel WiFi

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS |
| Routing | React Router v6 |
| Icons | Lucide React |
| Backend (DB / Auth / Storage / Realtime) | Supabase (PostgreSQL + PostGIS) |
| Backend (AI proxy) | Supabase Edge Functions (Deno) |
| Maps | Mapbox GL JS + react-map-gl |
| AI | Anthropic Claude (`claude-sonnet-4-5`) via Edge Function |
| Hosting | Vercel (static SPA) |
| Currency rates | open.er-api.com (no key) |

---

## Project structure

```
tripapp/
├── public/                       # Favicons + PWA icons
├── supabase/
│   ├── schema.sql                # Initial schema (tables, RLS, triggers)
│   ├── add_equipment_items.sql   # Post-launch migrations live as
│   ├── add_trip_invites.sql      #   separate files instead of being
│   ├── add_activity_types.sql    #   appended to schema.sql
│   └── functions/
│       └── chat/
│           └── index.ts          # Edge Function: Claude proxy
├── src/
│   ├── App.jsx                   # Routes + auth gate
│   ├── contexts/AuthContext.jsx
│   ├── lib/
│   │   ├── supabase.js
│   │   ├── countries.json        # 94 countries with flag/currency/map/emergency
│   │   ├── countries.js          # Country lookup helpers
│   │   ├── imageUpload.js        # Compress + upload to Supabase Storage
│   │   └── utils.js              # Date / currency / activity-type helpers
│   ├── pages/
│   │   ├── AuthPage.jsx
│   │   ├── HomePage.jsx
│   │   ├── NewTripPage.jsx
│   │   ├── TripPage.jsx          # The hub with the 7 tabs
│   │   └── JoinTripPage.jsx      # /join/:token landing page
│   └── components/
│       ├── ItineraryTab.jsx
│       ├── PackingTab.jsx
│       ├── MemoriesMapTab.jsx
│       ├── ChatTab.jsx
│       ├── CurrencyTab.jsx
│       ├── EmergencyTab.jsx
│       ├── MembersTab.jsx
│       ├── InviteLinkModal.jsx
│       ├── CountryCombobox.jsx
│       ├── CoverImageUpload.jsx
│       └── ...
├── tailwind.config.js            # Custom palette: coral, teal, sage, cream, ink
├── vite.config.js                # PWA manifest + workbox runtime caching
└── package.json
```

---

## Local setup

### 1. Clone + install

```bash
git clone https://github.com/YardenDaniel/tripapp.git
cd tripapp
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in the values:

| Variable | Purpose | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key | Yes |
| `VITE_MAPBOX_TOKEN` | Mapbox public token (`pk.…`) | Yes |

> The Anthropic key is **not** a client env var — it's stored as a Supabase Edge Function secret named `ANTHROPIC_API_KEY` and never reaches the browser.

### 3. Supabase setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. In the SQL Editor, run the files in this order:
   - `supabase/schema.sql` — initial tables, RLS, triggers, helpers
   - `supabase/add_equipment_items.sql` — packing list table
   - `supabase/add_trip_invites.sql` — shareable invite links
   - `supabase/add_activity_types.sql` — expanded activity type list
3. Storage → create a public bucket named `memories` (used for both photos and trip cover images, paths prefixed `covers/...` for covers)
4. Edge Functions → create a function named `chat`, paste the contents of `supabase/functions/chat/index.ts`, and add a secret `ANTHROPIC_API_KEY` (your `sk-ant-…` key)
5. Authentication → URL Configuration → set **Site URL** to your deployed origin (e.g. `https://tripapp-one.vercel.app`), and add `https://your-domain/**` to Redirect URLs

### 4. Run

```bash
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
npm run preview  # preview the production build locally
```

---

## Deployment

Static SPA — any host works (Vercel, Netlify, Cloudflare Pages). Currently deployed to Vercel:

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Install command:** `npm install`
- **Node version:** 20

Set the three `VITE_*` env vars in the host's dashboard. Pushes to `main` auto-deploy.

---

## Architecture notes

**No custom backend.** The browser talks directly to:
- Supabase (data, auth, storage, realtime) — protected by row-level security
- The Edge Function `chat` for AI calls — protected by Supabase JWT verification
- Mapbox tiles + geocoding
- open.er-api.com for currency rates

**RLS everywhere.** Every table has explicit `is_trip_member` / `is_trip_owner` policies — the anon key in the bundle is harmless on its own.

**Realtime** is enabled per-table via the `supabase_realtime` publication. Currently active for `activities` and `equipment_items`.

**PWA** is configured in `vite.config.js`. Service worker uses `CacheFirst` for Mapbox tiles and Supabase storage.

---

## Known gaps / roadmap

- No real role separation in RLS (`viewer` / `editor` / `owner` are defined but all members get edit access)
- AI tool-use is not wired up — the assistant suggests but can't add activities itself
- No budget / expense summary (`cost_amount` exists on activities, nothing aggregates it)
- No video upload UI (schema supports `media_type='video'`, UI doesn't yet)
- No ESLint config, no tests, no CI
- Activity end-time and multi-day activities (overnight flights) — schema has `end_time` but UI doesn't expose it
- README is now in English; some UI strings still leak Hebrew from earlier development

---

## License

Not yet licensed. Planning MIT.
