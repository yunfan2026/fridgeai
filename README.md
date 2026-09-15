# FridgeAI v2

Scan groceries **or receipts**, track what's fresh with **live** expiry countdowns, cut food waste,
and share one inventory with your **household** in real time.

**Stack:** React + Vite + Tailwind · Node/Express · Supabase (Postgres + Auth + Realtime) ·
Gemini 2.5 Flash (multimodal recognition + recipes).

## What's new vs v1

| Area | v1 | v2 |
|---|---|---|
| Recognition | Google Vision object labels (weak on produce) | Gemini multimodal — specific items, receipts, guardrails |
| Guardrails | none | rejects non-food/consumables, flags alcohol, allows pet food |
| Shelf life | ~50-item hardcoded table | Gemini estimate for any food + printed-date OCR |
| Expiry | frozen `daysLeft` (never counted down) | absolute `expires_at`, days-left computed live |
| Data | browser localStorage | Supabase Postgres with row-level security |
| Sharing | none | Google sign-in + invite code, realtime multi-user |
| Consumption | multi-step prompt | one-tap "Used up" + Undo, ± stepper, Full→Empty portion, "Cooked this" |
| Quality | — | eval harness (precision/recall, guardrail, date accuracy) + in-app correction tracking |

## Setup

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. SQL editor → paste and run [`supabase/schema.sql`](supabase/schema.sql).
3. **Auth — pick one (both can be on):**
   - **Email/password (fastest to test):** Authentication → Providers → **Email** is on by default.
     For quick local testing, turn **off** "Confirm email" so sign-up logs you straight in.
     (Turn it back on before launch.)
   - **Google (nicer for a live demo):** Authentication → Providers → enable **Google** with your
     Google OAuth client ID/secret.
4. Authentication → URL Configuration → add redirect URLs:
   `http://localhost:5173`, `http://localhost:3000`, and your production URL.
5. Settings → API → copy the **Project URL** and **anon key**.

### 2. Env
Fill in the two files (see [`.env.example`](.env.example)):

```
# .env  (client, public)
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# local.env  (server, secret)
GEMINI_API_KEY=your-gemini-key   # ⚠️ rotate the old one — it was shared in chat
GEMINI_MODEL=gemini-2.5-flash
PORT=3000
```

### 3. Run
```bash
npm install

# Dev (two terminals): Vite on :5173 proxies /api to Express on :3000
npm run dev:server
npm run dev:web

# Prod (single process): build the app, then Express serves it on :3000
npm run build && npm start
```

Open the dev URL, sign in with Google, **create a household**, and share the invite code with a
roommate to join. Scan a grocery photo or a receipt to fill your inventory.

## Recognition evaluation

The recognizer is measured, not just vibe-checked. `eval/run.mjs` runs a set of hand-labeled
real-world images through `/api/scan` and scores the output against ground-truth labels.

**Results** — averaged over 3 runs on 13 labeled images (grocery hauls, receipts, and non-food
guardrail cases):

| Metric | Score | What it measures |
|---|---|---|
| Item precision | **~85%** | Of items the app reported, how many were real (no hallucinations) |
| Item recall | **~94%** | Of items actually present, how many the app found |
| Item F1 | **~88%** | Balance of precision and recall |
| Guardrail accuracy | **~95%** | Non-food (pets, cleaning supplies, etc.) correctly ignored |
| False rejections | **0** | Real food wrongly rejected — none |

Notes: receipts scored near-perfect recall (abbreviations expanded, alcohol flagged). Printed dates
in *wide* shots read unreliably — which is why the app has a dedicated close-up **Capture date** step.
Failure-case analysis showed several precision "misses" were under-labeling (the model found real
items not in the ground truth), not model errors.

```bash
npm start              # server must be running
npm run eval           # scores eval/fixtures/* against /api/scan
```

Add labeled images + JSON to `eval/fixtures/` — see [`eval/fixtures/README.md`](eval/fixtures/README.md).
Reports item precision/recall/F1, guardrail accuracy, and date-extraction accuracy; saves a
timestamped run to `eval/results/`. The app also logs anonymized correction rates to `scan_feedback`.
(Personal eval photos are gitignored; labels and results are kept.)

## Deploy (Railway)
Set `GEMINI_API_KEY`, `GEMINI_MODEL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` as service
variables. Build command `npm run build`, start `npm start`. Add the Railway URL to Supabase's auth
redirect list.

## Layout
```
server.js              Express: /api/scan, /api/capture-date, /api/recipes, serves web/dist
web/                   React app (Vite)
  src/lib/             supabase client, api client, live expiry math
  src/hooks/           useSession, useHousehold, useInventory (realtime)
  src/components/      AuthGate, Onboarding, ScanView, InventoryView, RecipesView, ItemCard, ...
supabase/schema.sql    tables + RLS + realtime + create/join RPCs
eval/                  recognition eval harness
public/                legacy v1 UI (no longer served)
```
