# Lumière Pâtisserie — Live Inventory Tracking System

Architecture & implementation plan. Google Sheets is the single source of truth; a staff-facing
web app hosted on Railway reads and writes it with near-real-time two-way sync.

## 1. Goals

- Live count of all bar inventory items (see `data/inventory_seed.csv`, extracted from the staff PDF).
- Google Sheets is the **source of truth** — managers can edit the sheet directly and the app reflects it.
- Staff-facing frontend: view, search, sort, filter by category, adjust quantities, change units
  (dropdown), and see a "Low stock" view.
- Edits in the frontend update the sheet; edits in the sheet update the frontend (two-way sync).
- Hosted on Railway.

## 2. High-level architecture

```
┌─────────────────────┐         ┌──────────────────────────────┐
│   Google Sheet       │◄───────►│  Railway service (one app)   │
│   (source of truth)  │  Sheets │  ┌────────────────────────┐  │
│                      │   API   │  │ Node.js API (Express/  │  │
│  Tab: Inventory      │         │  │ Fastify)               │  │
│  Tab: Units          │         │  │  - GET /api/items      │  │
│  Tab: Log (optional) │         │  │  - PATCH /api/items/:id│  │
└──────────┬───────────┘         │  │  - GET /api/stream(SSE)│  │
           │ onEdit trigger      │  │  - POST /webhook/sheet │  │
           │ (Apps Script)       │  │  - in-memory cache     │  │
           └────────────────────►│  └────────────────────────┘  │
                                 │  Serves built React frontend │
                                 └──────────────┬───────────────┘
                                                │ HTTPS + SSE
                                     ┌──────────┴──────────┐
                                     │ Staff phones/tablets │
                                     │ (React web app, PWA) │
                                     └─────────────────────┘
```

One Railway service runs both the API and the static frontend build — one deploy, one URL, one
monthly cost (Hobby plan, ~$5/mo).

## 3. Google Sheet layout

**Tab `Inventory`** (one row per item):

| Column | Field         | Notes                                                        |
|--------|---------------|--------------------------------------------------------------|
| A      | ID            | Stable slug, e.g. `oat-milk`. Never changes; used as row key. |
| B      | Category      | DRINKS / INGREDIENTS / CONTAINERS / SUPPLIES                  |
| C      | Subcategory   | Milk & Dairy, Coffee, Teas, Syrups, …                        |
| D      | Item Name     | Display name                                                 |
| E      | Unit          | Data-validation dropdown fed by the `Units` tab              |
| F      | Quantity      | Number                                                       |
| G      | Low Threshold | Item counts as "low" when Quantity ≤ this                    |
| H      | Last Updated  | ISO timestamp, written by app or Apps Script                 |
| I      | Updated By    | Staff name/initials or "sheet"                               |

**Tab `Units`**: single column of allowed units — `unit, bottle, bag, box, carton, case, pack,
sleeve, jar, roll, tank, L, kg, lb`. The Unit column's dropdown (Data → Data validation) points at
this range, and the frontend fetches the same list for its own dropdown, so adding a unit in the
sheet adds it everywhere.

**Tab `Log`** (optional, phase 2): append-only audit trail of every change (who, what, old→new).

The stable `ID` column matters: the app addresses rows by ID, not row number, so sorting or
inserting rows in the sheet never corrupts writes.

## 4. Two-way sync design

### Frontend → Sheet (instant)
1. Staff taps +/− or edits quantity/unit in the app.
2. Frontend calls `PATCH /api/items/:id`.
3. Backend finds the row by ID and writes just the changed cells (`values.update`) via the Sheets
   API using a **service account** (its email is shared on the spreadsheet as Editor).
4. Backend updates its cache and broadcasts the change to all connected clients over SSE — every
   staff device updates within a second.

### Sheet → Frontend (near-real-time)
Google Sheets has no native webhooks, so we combine two mechanisms:

1. **Apps Script `onEdit` trigger (primary)** — a ~20-line script bound to the spreadsheet fires on
   every human edit and POSTs `{secret, editedRange}` to `POST /webhook/sheet-changed` on Railway.
   The backend re-reads the sheet, refreshes the cache, and broadcasts via SSE. Latency: 1–3 s.
2. **Polling fallback (safety net)** — backend refreshes the full sheet every 60 s regardless, so
   missed webhooks (or API-made edits, which don't fire `onEdit`) still converge.

A shared secret in the webhook payload (env var on Railway, Script Property in Apps Script) keeps
the endpoint from being spoofed.

### Conflict handling
Scale is small (~75 items, a handful of staff), so **last-write-wins per cell** is sufficient.
Because the backend writes only the cells that changed (not whole rows), two people editing
different items — or even the same item's quantity vs. unit — never clobber each other. The SSE
broadcast means stale screens self-correct within seconds.

### Sheets API quota
Default quota is 300 reads + 300 writes per minute per project. With the in-memory cache serving
all reads and writes being single-cell updates, a full bar staff won't get near it.

## 5. Backend (Railway)

- **Stack**: Node.js 20+, Fastify (or Express), `googleapis` client.
- **Endpoints**:
  - `GET /api/items` — cached inventory (instant, no Sheets read).
  - `PATCH /api/items/:id` — body `{quantity?, unit?, updatedBy}`; writes cells, bumps cache, broadcasts.
  - `GET /api/units` — dropdown options from the `Units` tab (cached).
  - `GET /api/stream` — Server-Sent Events; pushes `item-updated` / `full-refresh` events.
  - `POST /webhook/sheet-changed` — Apps Script webhook (secret-checked) → cache refresh + broadcast.
- **Cache**: plain in-memory object with the full item list + a `lastSync` stamp. No Redis/DB needed.
- **Railway env vars**:
  - `GOOGLE_SERVICE_ACCOUNT_JSON` — base64 of the service-account key file
  - `SHEET_ID` — spreadsheet ID from its URL
  - `WEBHOOK_SECRET` — shared with Apps Script
  - `APP_PASSWORD` — staff login (phase 1 auth)
- SSE (not WebSockets) keeps it simple and works fine through Railway's proxy.

## 6. Frontend

- **Stack**: React + Vite + Tailwind, built to static files served by the backend. Installable as a
  PWA so staff can pin it to their home screen.
- **Views**:
  - **All items** — table/card list with search, sort (name, quantity, category, last updated), and
    category/subcategory filter chips.
  - **Low stock** — items where `quantity ≤ lowThreshold`, badge count in the nav; low rows also
    highlighted amber/red in the main list.
  - **Item row controls** — big +/− steppers (tap-friendly), tap-to-type exact count, unit dropdown.
- **Live updates**: subscribes to `/api/stream`; optimistic UI on edits (update immediately, roll
  back on API error).
- **Auth (phase 1)**: one shared staff password → session cookie, plus a free-text "your name"
  field stamped into `Updated By`. Upgradeable later to per-user PINs or Google sign-in.

## 7. Google Cloud setup (one-time, ~10 minutes)

1. Create a Google Cloud project → enable **Google Sheets API**.
2. Create a **service account**, download its JSON key (goes into Railway env var).
3. Create the spreadsheet; share it with the service-account email as **Editor**.
4. Run the seed script (`scripts/seed-sheet.ts`) to populate `Inventory` + `Units` tabs from
   `data/inventory_seed.csv` and apply the unit dropdown validation.
5. Extensions → Apps Script: paste the `onEdit` webhook script, set the Railway URL + secret,
   install the trigger.

## 8. Railway deployment

1. Connect this GitHub repo to a new Railway project (auto-deploys on push to main).
2. Build: `npm run build` (builds frontend into `dist/`, backend serves it). Start: `npm start`.
3. Set the env vars from §5. Railway assigns `https://<app>.up.railway.app`; use it in the Apps
   Script webhook. Optionally attach a custom domain.

No database, no Redis, no cron jobs, no second service. If Railway restarts the container, the
cache repopulates from the sheet on boot — the sheet being the source of truth is what makes the
whole deployment this simple.

## 9. Alternatives considered

- **Postgres on Railway as source of truth, Sheets as an exported view** — more robust
  (transactions, real audit log) but managers lose direct sheet editing; revisit only if the sheet
  ever becomes a bottleneck.
- **Google Drive push notifications instead of Apps Script** — official change-watch API, but
  channels expire weekly and need renewal plumbing; `onEdit` + polling fallback is simpler and just
  as effective here.
- **No-code (AppSheet/Glide) on top of the sheet** — fastest to ship but limited UI control (no
  proper low-stock dashboard/SSE) and per-user pricing; a custom frontend on Railway stays a flat
  ~$5/mo.

## 10. Build order (for the execution phase)

1. Repo scaffold: `server/` (Fastify + googleapis), `web/` (Vite React), shared types.
2. Seed script + `data/inventory_seed.csv` → populate the sheet.
3. Backend: cache + `GET /api/items` + `PATCH /api/items/:id`.
4. Frontend: list/search/sort/filter + steppers + unit dropdown + low-stock view.
5. SSE stream + optimistic updates.
6. Apps Script webhook + polling fallback.
7. Auth (shared password) + `Updated By` stamping.
8. Deploy to Railway, wire env vars, end-to-end test both sync directions.
