# Lumière Pâtisserie — Live Inventory

Staff-facing web app for tracking live bar inventory. **Google Sheets is the
source of truth**; the app reads and writes it with two-way sync. Runs as a
single Railway service (Node API + React frontend).

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design.

## Quick start (local, no Google needed)

```bash
npm install          # installs server + web (workspaces)
npm run build        # builds the React frontend
npm start            # serves API + app on http://localhost:3000
```

With no Google credentials set, the app runs in **local mode**: a JSON file
(`server/data/inventory.local.json`, seeded from `data/inventory_seed.csv`)
acts as the store, so everything — editing, search, low-stock, live sync
across tabs — works with zero setup. Log in with the default password
`lumiere` (change via `APP_PASSWORD`).

For hot-reload dev, run the two dev servers in separate terminals:

```bash
npm run dev:server   # Fastify on :3000
npm run dev:web      # Vite on :5173 (proxies /api to :3000)
```

## Connecting Google Sheets

1. Google Cloud Console → new project → enable **Google Sheets API**.
2. Create a **service account**, download its JSON key.
3. Create a spreadsheet, share it with the service account's `client_email` as **Editor**.
4. Seed it:
   ```bash
   export GOOGLE_SERVICE_ACCOUNT_JSON="$(base64 -w0 service-account.json)"
   export SHEET_ID="<id from the sheet URL>"
   npm run seed
   ```
5. Set `GOOGLE_SERVICE_ACCOUNT_JSON` and `SHEET_ID` for the server (env or
   `server/.env`). On next start the app runs in **sheets mode** — edits flow
   both ways.
6. For instant sheet→app updates, install the Apps Script webhook in
   [`apps-script/Code.gs`](./apps-script/Code.gs) (instructions in the file).

## Deploy to Railway

1. New Railway project → deploy from this GitHub repo.
2. Nixpacks config (`nixpacks.toml`) runs `npm install` → `npm run build` →
   `npm start` automatically.
3. Set variables: `GOOGLE_SERVICE_ACCOUNT_JSON`, `SHEET_ID`, `APP_PASSWORD`,
   `WEBHOOK_SECRET`.
4. Use the assigned `https://<app>.up.railway.app` URL as `BACKEND_URL` in the
   Apps Script properties.

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | for sheets mode | base64 or raw service-account JSON |
| `SHEET_ID` | for sheets mode | from the spreadsheet URL |
| `SHEET_TAB` / `UNITS_TAB` | no | default `Inventory` / `Units` |
| `APP_PASSWORD` | recommended | shared staff password (default `lumiere`) |
| `WEBHOOK_SECRET` | recommended | shared with Apps Script |
| `POLL_INTERVAL_MS` | no | sheet re-poll interval, default 60000 |
| `PORT` | no | default 3000 (Railway sets this) |

## Project layout

```
server/          Fastify API, store abstraction (local + Sheets), SSE, auth
web/             React + Vite + Tailwind frontend (built + served by server)
scripts/         seed-sheet.js — populate the sheet from the CSV
apps-script/     Code.gs — onEdit webhook (sheet -> app sync)
data/            inventory_seed.csv — 71 items from the bar staff PDF
```
