# TripApp

A collaborative trip-planning Progressive Web App for travelers who want everything in one place: itinerary, photo map, packing list, AI travel assistant, weather, currency converter, emergency numbers, and real-time sync with co-travelers.

**Live:** [tripapp-one.vercel.app](https://tripapp-one.vercel.app) · **Stack:** React + Vite · Supabase (Postgres / Auth / Storage / Realtime) · Mapbox · Anthropic Claude

<!--
Screenshots help a lot here. Drop a few into /docs and reference them, e.g.:
![Memory Map](docs/memory-map.png)
-->

---

## What this project is

A solo, full-stack PWA I designed and built end to end — schema, security model, frontend, AI integration, and deployment. It's a real app I use on my own trips, not a tutorial clone. The goal was to ship something genuinely useful while practicing the parts of full-stack work that are easy to skip in toy projects: a row-level-security model that actually holds up, keeping secrets off the client, real-time collaboration, and graceful behavior on bad hotel WiFi.

**Highlights worth a look if you're reviewing my work:**

- **Security-first data layer** — every table is protected by PostgreSQL Row Level Security with reusable `is_trip_member` / `is_trip_owner` helpers, so the public anon key in the bundle can't read or write anything the user isn't a member of. ([schema.sql](supabase/schema.sql))
- **No secrets in the browser** — the Anthropic API key lives only as a Supabase Edge Function secret; the client calls a `chat` function over an authenticated request and never sees the key. ([functions/chat](supabase/functions/chat/index.ts))
- **Real-time collaboration** — itinerary and packing-list changes sync live between co-travelers via Supabase Realtime, no polling.
- **Sensor-data feature** — the Memory Map reads GPS coordinates straight from photo EXIF and pins them on a Mapbox map, with client-side image compression before upload.
- **Built to install** — full PWA with a service worker that uses `CacheFirst` for map tiles and storage, so it keeps working offline / on flaky connections.

---

## Features

- **Schedule** — daily itinerary with typed activities (food, stay, flight, train, hike, beach, and more), locations, times, and notes
- **Memory Map** — drop photos on a Mapbox map; GPS is pulled automatically from EXIF data
- **Packing list** — shared checklist per trip with real-time sync between co-travelers
- **AI Assistant** — chat with Claude about restaurants, attractions, transport, and local customs (proxied through a Supabase Edge Function so the API key stays server-side)
- **Weather** — current conditions for the trip's country or any searched place, via Open-Meteo (no API key) + Mapbox geocoding
- **Currency** — live exchange rates for 70+ currencies, defaulting to the trip's country
- **Emergency** — police / ambulance / fire numbers auto-loaded for the trip's country
- **Travelers** — invite friends by shareable link (WhatsApp-friendly) or by email
- **PWA** — installable to the home screen on iOS and Android, resilient on shaky WiFi

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS |
| Routing | React Router v6 |
| State / utils | Zustand, date-fns, Framer Motion, Lucide React |
| Backend (DB / Auth / Storage / Realtime) | Supabase (PostgreSQL + PostGIS) |
| Backend (AI proxy) | Supabase Edge Functions (Deno) |
| Maps & geocoding | Mapbox GL JS + react-map-gl |
| AI | Anthropic Claude (`claude-sonnet-4-5`) via Edge Function |
| Photo metadata | exifr (EXIF GPS extraction) |
| Weather | open-meteo.com (no key) |
| Currency rates | open.er-api.com (no key) |
| Hosting | Vercel (static SPA) |

---

## Architecture at a glance

```
                    ┌──────────────────────────────┐
   Browser (PWA) ───┤  React + Vite SPA on Vercel   │
                    └──────────────┬───────────────┘
                                   │  (anon key + user JWT)
          ┌────────────────────────┼───────────────────────────┐
          │                        │                            │
   ┌──────▼───────┐      ┌─────────▼──────────┐      ┌──────────▼─────────┐
   │  Supabase    │      │  Edge Function     │      │  Third-party APIs  │
   │  Postgres    │      │  `chat` (Deno)     │      │  Mapbox / weather  │
   │  + RLS       │      │  holds Claude key  │      │  / currency        │
   │  + Storage   │      └─────────┬──────────┘      └────────────────────┘
   │  + Realtime  │                │
   └──────────────┘        Anthropic Claude API
```

**No custom backend server.** The browser talks directly to Supabase (protected by RLS) for data, auth, storage, and realtime; to the `chat` Edge Function for AI (which holds the secret and verifies the user's JWT); and to a few keyless public APIs. This keeps the surface small while still keeping secrets server-side.

---

## Engineering decisions & trade-offs

> The decisions I'd actually want to talk through in an interview.

- **RLS as the primary access-control boundary, not app code.** Authorization lives in the database, so a forgotten check in the frontend can't leak another user's trip. Trade-off: policies are harder to debug than `if` statements and need their own mental model — I leaned on two `security definer` helper functions to keep them readable.
- **Edge Function purely as a secret-keeping proxy.** The earliest version called Claude directly from the browser with `anthropic-dangerous-direct-browser-access` — fast to build, but it ships your API key to every visitor. Moving the call to a Deno Edge Function fixed that without standing up a full backend. ([commit history shows the migration](supabase/functions/chat/index.ts))
- **Migrations as separate, ordered SQL files** rather than appending to `schema.sql`. It keeps the original schema readable and makes the evolution of the app legible to anyone reading the repo (packing list → invite links → expanded activity types).
- **Client-side image compression before upload.** Travel photos are huge; compressing in the browser cuts storage cost and upload time on slow connections, at the cost of a little perceived latency when adding a memory.
- **Keyless third-party APIs where possible** (weather, currency). Fewer secrets to manage and no per-user rate-limit headaches for non-sensitive data.
- **PWA + `CacheFirst` for tiles/storage.** The app is meant to be used abroad on bad WiFi, so offline resilience was a feature, not an afterthought.

I keep an honest [known-gaps list](#known-gaps--roadmap) below — these are deliberate scoping decisions, and I'm happy to talk about how I'd close each one.

---

## Project structure

```
tripapp/
├── public/                       # Favicons + PWA icons
├── supabase/
│   ├── schema.sql                # Initial schema (tables, RLS, triggers, helpers)
│   ├── add_equipment_items.sql   # Post-launch migrations live as separate,
│   ├── add_trip_invites.sql      #   ordered files instead of being appended
│   ├── add_activity_types.sql    #   to schema.sql
│   └── functions/
│       └── chat/index.ts         # Edge Function: Claude proxy (holds the secret)
├── src/
│   ├── App.jsx                   # Routes + auth gate
│   ├── contexts/AuthContext.jsx
│   ├── lib/
│   │   ├── supabase.js
│   │   ├── countries.json        # Countries w/ flag, currency, map center, emergency #s
│   │   ├── countries.js          # Country lookup helpers
│   │   ├── imageUpload.js        # Compress + upload to Supabase Storage
│   │   └── utils.js              # Date / currency / activity-type helpers
│   ├── pages/
│   │   ├── AuthPage.jsx
│   │   ├── HomePage.jsx
│   │   ├── NewTripPage.jsx
│   │   ├── TripPage.jsx          # The hub with the 8 tabs
│   │   └── JoinTripPage.jsx      # /join/:token landing page
│   └── components/
│       ├── ItineraryTab.jsx      ├── ChatTab.jsx        ├── EmergencyTab.jsx
│       ├── PackingTab.jsx        ├── WeatherTab.jsx     ├── MembersTab.jsx
│       ├── MemoriesMapTab.jsx    ├── CurrencyTab.jsx    └── ... (modals, inputs)
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
3. Storage → create a public bucket named `memories` (used for both photos and trip cover images; covers are prefixed `covers/...`)
4. Edge Functions → create a function named `chat`, paste `supabase/functions/chat/index.ts`, and add a secret `ANTHROPIC_API_KEY` (your `sk-ant-…` key)
5. Authentication → URL Configuration → set **Site URL** to your deployed origin (e.g. `https://tripapp-one.vercel.app`) and add `https://your-domain/**` to Redirect URLs

### 4. Run

```bash
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
npm run preview  # preview the production build locally
```

---

## Deployment

Static SPA — any host works (Vercel, Netlify, Cloudflare Pages). Currently on Vercel:

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node version:** 20

Set the three `VITE_*` env vars in the host's dashboard. Pushes to `main` auto-deploy.

---

## Architecture notes

- **RLS everywhere.** Every table has explicit `is_trip_member` / `is_trip_owner` policies — the anon key in the bundle is harmless on its own.
- **Realtime** is enabled per-table via the `supabase_realtime` publication, currently for `activities` and `equipment_items`.
- **PostGIS** stores memory and activity coordinates as `geography(point, 4326)` with a GiST index for location queries.
- **PWA** is configured in `vite.config.js`; the service worker uses `CacheFirst` for Mapbox tiles and Supabase storage.

---

## Known gaps / roadmap

These are deliberate scoping decisions, not surprises — happy to discuss how I'd tackle each:

- **Role separation in RLS** — `viewer` / `editor` / `owner` exist in the schema, but all members currently get edit access; the next step is per-role policies.
- **Real AI tool-use** — the assistant suggests itinerary changes but can't yet apply them; wiring up Claude tool-use to write activities directly is the plan.
- **Budget summary** — `cost_amount` exists on activities; nothing aggregates it into a per-trip total yet.
- **Video upload UI** — the schema supports `media_type='video'`; the UI surfaces photos only so far.
- **Tooling** — no ESLint config wired up, no tests, no CI yet.
- **i18n cleanup** — the app is English-first, but a few Hebrew strings linger from earlier development.

---

## License

Not yet licensed. Planning MIT.
