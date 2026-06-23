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
2. **Only ONE `npm run dev` at a time.** A `predev` guard (`scripts/predev.mjs`) runs
   automatically and kills any stale Next dev server before starting a new one, so
   instances can't stack up and exhaust RAM (the confirmed cause of the past crash).
   You can also run it manually any time: `npm run kill-dev`.
3. Dev/build scripts cap the heap via `NODE_OPTIONS=--max-old-space-size=2048` (see package.json).
   Note: a verified-healthy dev server here peaks ~780 MB. If you ever see it climb past
   ~2 GB, something is wrong — stop it and debug.
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
