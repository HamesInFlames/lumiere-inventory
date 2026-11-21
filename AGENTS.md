# AGENTS.md — project conventions

## Project
- Name: Lumière Inventory (Lumière Pâtisserie live inventory)
- Developer: James (Kim Consultant)
- Stack: Node 20+ (ESM), Fastify 4 API, React 18 + TypeScript, Vite 5, Tailwind CSS 3, Google Sheets API (googleapis); npm workspaces (`server`, `web`)
- Repo: github.com/HamesInFlames/lumiere-inventory
- Deploy: Railway via `nixpacks.toml`

## Commands
- Dev: `npm run dev:server` and `npm run dev:web` (two terminals)
- Build: `npm run build`
- Start: `npm start`
- Seed sheet: `npm run seed`
- Test: none
- Lint: none

## Code conventions
- Server is plain JavaScript (ES modules) in `server/src`
- Web is TypeScript (strict mode) in `web/src`, styled with Tailwind
- Google Sheets is the source of truth; with no Google credentials the app runs in local mode (JSON file store)
- See `ARCHITECTURE.md` and `docs/FEATURE-*.md` for design notes

## Workflow
- Read tasks/todo.md before starting work
- Update tasks/status.md after each session
- Log decisions in tasks/decisions.md
- Run `npm run build` before committing

## Do NOT
- Change existing styling, copy or behaviour the task did not ask about
- Install packages without documenting in tasks/decisions.md
- Modify deployment config without approval
- Delete .env files

## Lessons
<!-- added by /kc-workflow:reflect -->
