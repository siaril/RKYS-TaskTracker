@AGENTS.md

# TaskTracker

Kanban task tracker for teams. Web-based, mobile-friendly, styled like monday.com.
Built phase-by-phase (see `plan` notes); verify each phase before moving on.

## Stack
- Next.js 16 (App Router) + TypeScript, `src/` dir, import alias `@/*`
- PostgreSQL (existing local DB `tasktracker`) via Prisma 7 + `@prisma/adapter-pg`
- Auth.js (NextAuth v5) — Google sign-in only
- Tailwind CSS v4 (theme tokens in `src/app/globals.css`)
- Later phases: dnd-kit (kanban), Tiptap (rich-text comments)

## Run it locally
1. Postgres must be running locally with the `tasktracker` database.
2. Fill in `.env` (gitignored) — see "Secrets" below.
3. `npm run dev` → open http://localhost:3000 yourself.
4. Prisma: `npm run db:migrate` (apply schema changes), `npm run db:generate`
   (regenerate client), `npm run db:studio` (browse data).

## Secrets (.env — never committed)
- `DATABASE_URL` — local Postgres connection string.
- `AUTH_SECRET` — random secret (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — from Google Cloud Console:
  APIs & Services → Credentials → Create OAuth client ID → Web application.
  Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.

## ⚠️ Memory rules (prevent the OOM crash — read every session)
A past "build everything at once" attempt spawned a runaway Node process that ate all RAM
and crashed the laptop during preview. Never let this recur:
1. **Build incrementally**, one small phase at a time. Never "one shot."
2. **`npm run dev` runs through a memory-aware supervisor** (`scripts/dev.mjs`). It:
   - kills any stale Next dev server first (no stacking), and
   - watches RAM every ~1.5s and **auto-kills the dev server if it exceeds ~3 GB
     (`DEV_TREE_CAP_MB`) or free system RAM drops below ~800 MB (`DEV_FREE_FLOOR_MB`)** —
     so the laptop can never OOM-crash again. A healthy server here is ~700–960 MB.
   - `npm run kill-dev` stops a stray server manually; `npm run dev:raw` bypasses the
     supervisor (avoid unless debugging).
3. This machine runs heavy background software (Lenovo Vantage, NVIDIA, Chrome, WhatsApp,
   Edge WebView2) → little RAM headroom. Close spare Chrome tabs before `npm run dev`.
4. The heap cap `NODE_OPTIONS=--max-old-space-size=2048` only limits V8 (JS) memory, NOT
   Turbopack's native memory — that's why the supervisor watches total RAM, not just heap.
4. Prisma uses a **`globalThis` singleton** (`src/lib/prisma.ts`) — don't bypass it.
5. **Preview by opening http://localhost:3000 yourself.** If an in-tool preview/browser is
   used, start ONE instance and stop it when done. No repeated/stacked previews.
6. Never run `build` and `dev` together. If Node RAM climbs in Task Manager, stop the
   server first, then debug. Watch for React render loops (setState in effects).

## Project structure
- `src/app/(app)/*` — protected pages (layout calls `requireUser()` → redirects to /signin).
- `src/app/signin/page.tsx` — public sign-in.
- `src/auth.ts` — NextAuth config; `src/lib/session.ts` — `requireUser()` helper.
- `src/lib/prisma.ts` — Prisma singleton. `src/lib/actions/*` — server actions.
- `prisma/schema.prisma` — DB schema (grows per phase). Generated client: `src/generated/prisma` (gitignored).
