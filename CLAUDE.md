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
- **Email notifications (Phase B — optional locally):**
  - `APP_URL` — absolute base for task links in emails (local: `http://localhost:3000`).
  - `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` — SMTP creds.
    Gmail: host `smtp.gmail.com`, port `465`, user = your Gmail, pass = a **Google App
    Password** (Google Account → Security → 2-Step Verification → App passwords; the
    account password won't work), `MAIL_FROM` = that Gmail address.
  - `CRON_SECRET` — shared secret the digest cron must present.
  - Trigger a digest manually: `POST /api/cron/email-digest?key=<CRON_SECRET>` (add `&dry=1`
    to preview without sending). A free external cron (**cron-job.org**) hits it every ~5 min
    in prod.
  - ⚠️ On Render, outbound SMTP only works on a **paid** web service (free blocks SMTP ports).
- **WhatsApp notifications (Phase C — via Kapso / official Cloud API):**
  - `KAPSO_API_KEY` — Kapso project API key (Kapso dashboard → Settings → API Keys).
  - `KAPSO_PHONE_NUMBER_ID` — the connected number's ID (WhatsApp → Phone numbers → detail).
  - `WHATSAPP_TEMPLATE_NAME` — the approved Utility template's name.
  - `WHATSAPP_TEMPLATE_LANG` — template language code; **defaults to `en_US`**. Set it only if
    your template uses another language.
  - Sends go out on the **same cron** as the email digest (`POST /api/cron/email-digest`) — the
    tick runs email + WhatsApp together. WhatsApp is per-notification (one template message per
    unread notification), for users with `whatsappNotifications` on + a `phone` set.
  - Bulk-load phone numbers by user id: `npm run db:import-phones -- <phones.csv>` (see
    `prisma/import-phones.ts`).

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
