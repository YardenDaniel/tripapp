# TripApp - Claude Code Context

> This file gives Claude Code context about the project. It is read automatically every time you open Claude Code in this directory.

---

## Project Overview

**TripApp** is a collaborative trip-planning Progressive Web App (PWA) that lets travelers organize itineraries, share memories on a map, chat with an AI assistant, manage budgets, and coordinate with co-travelers in real-time.

**Status:** Mature personal project. Most MVP features are working. Some hardening, security, and UX polish remaining before public launch.

**Repository:** https://github.com/YardenDaniel/tripapp
**License:** None yet (planning to add MIT)

---

## Tech Stack

### Frontend
- **React 18** + **Vite** (build tool)
- **React Router v6** (routing)
- **TailwindCSS** with a custom theme: `gold` / `lacquer` / `ink` / `ivory` / `jade` palette, `display` + `accent` font families
- **Zustand** (installed; not heavily used yet)
- **Framer Motion** (installed; for animations)
- **Lucide React** (icons)
- **date-fns** (date handling)
- **vite-plugin-pwa** (offline + installability)

### Backend / Data
- **Supabase** — Postgres + Auth + Storage + Realtime
- **PostGIS** — for attaching photos to GPS coordinates
- **RLS (Row Level Security)** — full coverage on all tables, with `is_trip_member` / `is_trip_owner` helpers

### External Services
- **Mapbox GL JS** + `react-map-gl` — for maps
- **Anthropic Claude API** — currently called directly from the browser (`claude-sonnet-4-5`)
- **exifr** — reads GPS from photo EXIF data
- **open.er-api.com** — live currency exchange rates

---

## Directory Structure

```
tripapp/
├── public/                    # PWA assets (icons missing — needs filling)
├── supabase/
│   └── schema.sql             # 7 tables, full RLS, triggers, seed data
├── src/
│   ├── App.jsx                # Auth router + cross-screen state
│   ├── main.jsx
│   ├── contexts/
│   │   └── AuthContext.jsx
│   ├── lib/
│   │   ├── supabase.js        # Client + env var validation
│   │   └── utils.js           # formatDate, daysBetween, ACTIVITY_TYPES, cn
│   ├── pages/
│   │   ├── AuthPage.jsx       # Sign up / sign in
│   │   ├── HomePage.jsx       # Trip list
│   │   ├── NewTripPage.jsx    # Create trip
│   │   └── TripPage.jsx       # Hub with 6 tabs
│   ├── components/
│   │   ├── ItineraryTab.jsx   # Days + activities, Realtime sync
│   │   ├── MemoriesMapTab.jsx # Largest component (~1000 lines) — central feature
│   │   ├── ChatTab.jsx        # AI assistant with "Coming Soon" fallback
│   │   ├── CurrencyTab.jsx    # Live converter, 7 currencies
│   │   ├── EmergencyTab.jsx
│   │   ├── MembersTab.jsx     # Invite co-travelers
│   │   ├── LoadingScreen.jsx
│   │   └── Logo.jsx
│   └── styles/
│       └── index.css
├── vite.config.js             # PWA config
├── tailwind.config.js
├── package.json
├── .env.example               # Template — never commit .env.local
├── .gitignore
└── README.md                  # In Hebrew
```

---

## Working Conventions

### Language Rules — IMPORTANT

- **App UI:** English only. All buttons, labels, tabs, prompts, error messages, and copy must be in English. Target audience is international.
- **Code:** English (variable names, function names, comments).
- **Documentation files** (`README.md`, this file, etc.): English.
- **Chat with the developer (Yarden):** Hebrew. When responding to me in Claude Code conversations, respond in Hebrew unless I switch to English first.
- **Existing inconsistencies:** README.md is currently in Hebrew, and some Hebrew strings remain in the code from earlier development. Treat them as legacy — flag them when you see them, but don't auto-translate without my approval.

### Working Style — IMPORTANT

**I work in a careful, approval-based mode.** Do NOT make changes without my explicit approval first.

For any non-trivial change:
1. **Read** the relevant files first
2. **Explain** what you plan to do, in plain language
3. **Wait** for my approval ("yes", "go", "אישור", or similar)
4. **Then** make the change

Trivial changes that don't need approval:
- Reading files to understand context
- Running read-only commands like `git status`, `git log`, `npm list`
- Listing files in a directory

Always require approval for:
- Editing or creating files
- Running `npm install` (adding/removing dependencies)
- Running `git commit`, `git push`, or any state-changing git command
- Database migrations or schema changes
- Anything that touches `.env*` files

### Communication Style

- Be concise. I prefer short, scannable answers over walls of text.
- When proposing a plan, use numbered steps.
- When showing trade-offs, use a table or bullet list.
- Use Hebrew when responding to me; use English when writing code, comments, or anything that goes into the project itself.

---

## Known Issues & Tech Debt

These are problems I am already aware of. Do not "discover" them as bugs — instead, when relevant, mention they are tracked here.

### 🔴 Critical (security / blockers for production)

- **Anthropic API key is exposed in the browser bundle** via `VITE_ANTHROPIC_API_KEY`. Direct browser calls use the `anthropic-dangerous-direct-browser-access` flag. Before going to production, this **must** move to an Edge Function or backend proxy.

### 🟡 Medium (functional gaps)

- **No real role separation** in RLS — `viewer` and `editor` roles exist in the schema, but any trip member can edit. RLS policies need tightening.
- **AI tool-use is not real** — the chat says "Want me to add this to your itinerary?" but does not actually call any tool to add an activity. Needs real tool-use implementation.
- **No budget / expense summary screen** — `cost_amount` / `cost_currency` exist on activities, but nothing aggregates them.
- **Video upload UI may not exist** — the schema supports `media_type='video'`, but the UI may not surface it.
- **Avatar / cover image upload UI may be incomplete** — schema and storage buckets are ready, but UI flow may be missing.
- **Emergency numbers seeded only for Vietnam** — no auto-population mechanism for other countries.
- **No invite-by-link / invite-by-code** — only by email of an existing registered user.

### 🟢 Low (polish / consistency)

- **PWA manifest is marked `lang: 'en'` and `dir: 'ltr'`** which is correct for the new direction (English UI), but the README is still Hebrew — possible old artifact.
- **Public icon assets missing**: `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `favicon.svg`, `apple-touch-icon.png`. Build will not work correctly without these.
- **No ESLint config** despite a `lint` script existing.
- **No tests, no CI**.
- **No prominent logout button**, no settings page.

---

## Useful Commands

```bash
# Development
npm run dev              # Start dev server (Vite, usually on http://localhost:5173)
npm run build            # Production build
npm run preview          # Preview production build locally

# Git
git status               # See what's changed
git add <file>           # Stage a specific file
git commit -m "..."      # Commit (always ask me before committing)
git push                 # Push to GitHub
git log --oneline -10    # See last 10 commits

# GitHub CLI
gh pr create             # Open a Pull Request
gh issue list            # See open issues
```

---

## Environment Variables

The project uses `.env.local` (gitignored). The template is in `.env.example`. Required variables:

| Variable | Purpose | Required? |
|----------|---------|-----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `VITE_MAPBOX_TOKEN` | Mapbox public token | Yes |
| `VITE_ANTHROPIC_API_KEY` | Claude API key | Optional — Chat tab shows "Coming Soon" without it |

⚠️ **Never** ask me to print the contents of `.env.local`. Never include real keys in code, commits, or commit messages.

---

## Roadmap (loose, in priority order)

1. **Add missing PWA icons** to `public/` so the build works.
2. **Move Claude API call to a backend proxy** (Supabase Edge Function preferred).
3. **Implement real AI tool-use** so chat can actually create activities.
4. **Tighten RLS** to enforce `viewer` / `editor` / `owner` separation.
5. **Add budget / expense summary screen**.
6. **Add ESLint config + basic test setup**.
7. **Translate README.md to English** (or add an English version alongside).
8. **Add invite-by-link flow** for non-registered users.

---

## Notes for Claude Code

- This is a personal portfolio project. Code quality and clarity matter more than shipping speed.
- Prefer small, focused commits. Never bundle unrelated changes into one commit.
- When suggesting new dependencies, always check `package.json` first — many things may already be installed (Zustand, Framer Motion, etc.).
- When editing `MemoriesMapTab.jsx` (the ~1000-line component), be extra careful — read the whole file before changing anything, and prefer surgical edits over rewrites.
