# TaskTracker — Handoff & Contributor Guide

Read this before changing anything. It captures **what this app is**, **how it's
built**, and **the standards to follow** so any agent or human can continue the work
consistently. Companion docs: `CLAUDE.md` (run + memory rules), `AGENTS.md` (Next.js
note), `DEPLOY.md` (deployment).

---

## 1. What it is
A Kanban task tracker for **PT Rekayasa Analisa Digital**'s team. Web-based,
mobile-friendly, styled like monday.com. Core domain:

- **Clients** have many **Projects**. A Project belongs to one Client and uses many
  **Products** (Erica, JourneyON) via a join table.
- A **Project** has **Members** (roles: Owner / Editor / Viewer), a configurable
  **WorkflowStatus** set, **Tags**, and **Tasks**.
- A **Task** has title, description, status, priority, assignee, due date, owner
  (= creator), tags, **Comments** (rich text + image upload), and an **Activity** log.
- **Login is Google-only and allowlisted** — only users seeded in the DB can sign in.

Built phase-by-phase (0–9). All phases are merged to `main` and the app is deployed.

## 2. Tech stack (don't swap without good reason)
- **Next.js 16** (App Router) + **TypeScript**, `src/` dir, import alias `@/*`.
  ⚠️ Next 16 has breaking changes vs older versions — see `AGENTS.md`; read
  `node_modules/next/dist/docs/` when unsure.
- **PostgreSQL** via **Prisma 7** + **`@prisma/adapter-pg`** (driver adapter).
- **Auth.js (NextAuth v5)** — Google provider, database sessions.
- **Tailwind CSS v4** (theme tokens in `src/app/globals.css`, no config file).
- **dnd-kit** (kanban drag/drop), **Tiptap** (rich-text comments),
  **sanitize-html** (comment safety), **sharp** (image optimization, build-time).

## 3. Architecture & where things live
```
src/app/(app)/*            Protected pages. (app)/layout.tsx calls requireUser().
src/app/signin/page.tsx    Public sign-in (branded; allowlist error message).
src/app/api/auth/[...nextauth]/route.ts   Auth.js route handler.
src/app/api/upload/route.ts               Image upload (auth-guarded, writes public/uploads).
src/auth.ts                NextAuth config: Google provider, session callback,
                           signIn allowlist callback (DB-existence check).
src/lib/session.ts         requireUser() -> redirects to /signin if unauthed.
src/lib/prisma.ts          Prisma singleton (globalThis). NEVER instantiate PrismaClient elsewhere.
src/lib/access.ts          getProjectAccess(), atLeast(), isAdmin(), visibleProjectsWhere().
src/lib/actions/*          Server actions, one file per domain (clients, products,
                           projects, members, statuses, tasks, comments, auth).
src/lib/{format,default-statuses,comment-types,access,sanitize,uploads}.ts
src/lib/{notify,mentions-extract,mention-types,releases}.ts   notifications + mentions + versioning
src/components/*           UI. Server components by default; "use client" only when needed.
                           Notable: notification-bell, whats-new, copy-link-button, rich-text-editor.
src/generated/prisma/*     Generated Prisma client (GITIGNORED — run db:generate).
prisma/schema.prisma       Schema. prisma/migrations/* committed.
prisma/{seed,team-users,add-user}.ts      Seeding + allowlist scripts.
scripts/{dev,predev,dev-cache}.mjs   Memory-safe dev supervisor + corrupt-.next auto-clean (§8).
scripts/release-notes.ts   Prints the latest release as a WhatsApp announcement.
docs/ACCESS.md             Role/permission reference.
prisma/import-phones.ts    Bulk-load WhatsApp phones by user id from CSV (npm run db:import-phones).
render.yaml, DEPLOY.md     Deployment.
```

### Data model (Prisma enums in CAPS)
User(role: ADMIN|MEMBER, disabled) · Account · Session · VerificationToken · Client ·
Product · Project · ProjectProduct · ProjectMember(role: OWNER|EDITOR|VIEWER) ·
WorkflowStatus(kind: NORMAL|DELETED) · Task(priority: LOW|MEDIUM|HIGH|URGENT) · Tag ·
TaskTag · Comment(parentId → single-level reply threading) · Attachment ·
TaskActivity(type: CREATED|UPDATED|STATUS_CHANGED|COMMENTED|COMMENT_DELETED|DELETED|RESTORED) ·
Notification(type: TASK_ASSIGNED|MENTIONED_IN_DESCRIPTION|MENTIONED_IN_COMMENT|
COMMENT_ON_ASSIGNED_TASK|COMMENT_ON_OWNED_TASK).

## 4. Coding patterns (match these)
- **Data flow = Server Components + Server Actions.** Read data in async server
  components via `prisma`; mutate via server actions in `src/lib/actions/*`. Avoid
  client-side fetching unless interaction requires it (board drag, Tiptap, drawers).
- **Forms with validation/errors:** client component + `useActionState`; the action
  returns `{ error }`. On success, `redirect("/...?toast=...")` and render
  `<FlashToast>` on the destination page. See `task-form.tsx` + `flash-toast.tsx`.
- **Simple mutations:** plain `<form action={serverAction}>` with hidden inputs (no
  client component). See clients/products pages.
- **Access control is mandatory in every action and page that touches a project.**
  Use `getProjectAccess(projectId, user)`; gate with `atLeast(role, "EDITOR"|"OWNER")`;
  admins bypass (treated as OWNER). Pages hide existence with `notFound()` for
  non-members. Never trust the client.
- **Comments:** store Tiptap HTML **after `sanitize-html`** (strips script/onerror/
  javascript:). Render with `dangerouslySetInnerHTML` inside `.comment-html`.
- **Activity logging:** write `TaskActivity` rows on create / field-diffs / status
  moves / comments (see `tasks.ts`, `comments.ts`). Keep it centralized in the action.
- **Notifications:** after a mutation, call `notify()` (`src/lib/notify.ts`) — best-effort
  (never breaks the action), excludes the actor, and collapses one event into a single
  notification per person by priority. Mention ids come from `extractMentionIds()`.
- **@-mentions:** the Tiptap editor (`rich-text-editor.tsx`, opt-in `mention` prop) inserts
  `<span data-type="mention" data-id=…>` chips; the sanitizer allowlists them; the picker is
  scoped to project members via `searchMentionables`. Used in comments and task descriptions.
- **Styling:** use the monday-ish design tokens (`bg-surface`, `text-ink`,
  `text-muted`, `border-border`, `bg-primary`, status colors) from `globals.css`;
  `cn()` from `@/lib/utils` to merge classes; **lucide-react** icons. Keep components
  small and consistent with neighbors.
- **Server-action files** must export only async functions (`"use server"`). Put
  shared types in a separate file (e.g. `comment-types.ts`).

## 5. Adding a feature — the standard workflow
1. `git checkout -b feat/<short-name>` off `main`.
2. **Schema** change in `prisma/schema.prisma` → `npm run db:migrate -- --name <x>` →
   `npm run db:generate`. Backfill existing rows with a one-off `prisma/*.ts` script if
   needed (run, then delete it).
3. **Server actions** with access checks + validation.
4. **UI** (server components; client only where needed). Reuse existing components.
5. **Verify (all three):**
   - `npx tsc --noEmit` (must be clean).
   - A throwaway **DB smoke test** (`prisma/smoke.ts`) that exercises the new queries
     with **temporary, self-cleaning** data — run, then delete it.
   - **One** dev server compile probe (`npm run dev`, curl the route, stop the server).
6. **Commit** (see §6) and **push the branch**.
7. Let the user verify, then **`git checkout main && git merge --ff-only <branch>` →
   `git push`**.

## 6. Git & commit standards
- **`main`** is the integration branch **and** the Render deploy branch. Keep it green.
- **One branch per feature/fix:** `feat/...`, `fix/...`, `chore/...`, `docs/...`.
- **Fast-forward merges** to main (linear history). Branches are short-lived.
- **Commit messages:** imperative subject (<~72 chars) + bullet body explaining what &
  why. End with: `Co-Authored-By: <author> <email>`.
  - ⚠️ Gotcha on this Windows/PowerShell setup: inner double-quotes in `git commit -m`
    here-strings break. Use `git commit -F <file>` or `-m` lines without inner `"`.
- **Commit identity** for this repo is set locally (`Aril Haromi <aril.haromi@gmail.com>`).
- Don't commit secrets: `.env*`, `/src/generated`, `/public/uploads/*`, `/.claude/`
  are gitignored. Verify before committing.

## 7. Local setup
1. `npm install`
2. Create `.env` (see "Secrets" in `CLAUDE.md`): `DATABASE_URL`, `AUTH_SECRET`,
   `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, optional `AUTH_URL`.
3. `npm run db:generate` (the client is gitignored).
4. Postgres running locally (db `tasktracker`) — or point `DATABASE_URL` at Render.
5. `npm run dev` → open http://localhost:3000.
Useful: `db:migrate`, `db:seed`, `db:add-user`, `db:studio`, `kill-dev`.

## 8. ⚠️ Memory / "do not crash the laptop" rules (critical)
A past mistake ran a runaway Node process that OOM-crashed the machine. The guards:
- **`npm run dev` is supervised** (`scripts/dev.mjs`): kills stale dev servers first,
  then watches RAM and **auto-kills** the dev server if it exceeds ~3 GB or free RAM
  gets low. Don't bypass it (`dev:raw` exists only for debugging).
- **Only ONE dev server at a time.** Before starting one, others are killed; manually:
  `npm run kill-dev`.
- **Use the Prisma singleton** (`src/lib/prisma.ts`); a new client per hot-reload leaks.
- Build incrementally; never run `build` and `dev` together; verify each change.

## 9. Auth & the login allowlist
- Sign-in is **restricted to users that exist in the DB** (`signIn` callback in
  `src/auth.ts`). Google provider uses `allowDangerousEmailAccountLinking` so
  pre-seeded users link on first login.
- The team is seeded from `prisma/team-users.ts` (run by `seed.ts`).
- **Add one person:** `npm run db:add-user -- "Name" "email@x.com" [ADMIN|MEMBER]`
  (against prod: run in Render Shell, or locally with the prod `DATABASE_URL`).

## 10. Deployment (Render.com)
Blueprint `render.yaml`: Postgres + web service. Build = `prisma generate` +
`next build`. Start = `prisma migrate deploy` + `db:seed` (idempotent; also keeps the
allowlist current) + `next start`. Set `AUTH_GOOGLE_ID/SECRET` and `AUTH_URL`
(= the public URL) in the dashboard, and register that URL's
`/api/auth/callback/google` in Google Console. Full steps in `DEPLOY.md`.
Live: https://rekayasa-task-tracker.onrender.com
(custom domain: https://tasktracker.rekayasa.io — same Render service/DB)

## 11. Known gaps / TODO (good next tasks)
- **Notifications — WhatsApp** is not built yet (in-app + email are). See §13.
- **Real-time bell:** the notification count polls every ~50s; a logged-in user can wait up
  to that long for a new badge. Lower the interval or add SSE/WebSocket for instant updates.
- **Project delete is a permanent hard delete** (Settings → Delete project) with no
  confirm/soft-delete — unlike *task* delete, which is now recoverable. Consider matching it.
- **No automated tests** yet — only typecheck + manual smoke tests. Adding Vitest/
  Playwright for access-control rules + notification dedup would pay off.
- **Prod DB external access** was open to the internet (`0.0.0.0/0`); lock it down in
  Render Access Control (the app uses the internal connection).
- Ignore the sibling decoy folders `RKYS-TaskTracker` / `RKYS-TaskTracker2` (old
  attempts); the live project is this folder only.

## 12. What shipped on 2026-06-25 (recent feature batch, all merged + deployed)
- **Threaded comment replies + @mentions.** Single-level reply threading; `@`-mention
  project members in **comments and task descriptions** (Tiptap mention extension; mentions
  stored as sanitized spans). Replies pre-fill an `@author` mention so flat threads stay clear.
- **Recoverable task delete.** "Delete" now moves a task to a per-project **Deleted**
  WorkflowStatus column (`kind=DELETED`, pinned last, OWNER/admin-only, locked in the editor)
  instead of hard-deleting. `deleteTask`/`restoreTask`; permissions: OWNER/admin any, EDITOR
  own only, VIEWER none. Confirmation dialog on delete.
- **App versioning + "What's new".** `src/lib/releases.ts` is the single source (latest entry
  = the version shown in the sidebar badge + the auto "What's new" modal). `npm run
  release-notes` prints a WhatsApp-ready announcement. **Release flow:** add a `releases.ts`
  entry → bump `package.json` (`npm version`) → merge → `npm run release-notes`.
- **In-app notifications (Phase A).** Bell in the top-right header; see §13.
- **Smaller UX:** "Assign to me" button + a People meta row (creator/assignee) on the task
  detail; **Copy-link** buttons (project + task) so shared URLs don't get truncated; a friendly
  "request access" page (names the owners) instead of a bare 404 for non-members; rebrand to
  **Rekayasa Task Tracker** with a **RAD** logo mark.
- **Dev safety:** `predev` auto-clears a corrupt `.next` cache after an unclean dev exit
  (the build-worker "fork bomb" was a corrupt-cache symptom). See `scripts/dev-cache.mjs`.
- **`docs/ACCESS.md`** documents the full role/permission model.

## 13. Notifications (five triggers, three channels — all shipped)
Built in phases; all live as of v0.3.0.
- **Phase A — in-app (DONE).** `Notification` model; triggers in `createTask`/`updateTask`
  (new assignee + newly-added description mentions) and `addComment` (mentions + assignee +
  owner). `notify()` excludes the actor and dedups per person. Bell UI with unread badge +
  dropdown + mark-read + ~50s polling.
- **Phase B — email (DONE, `feat/notifications-email`).** Outbox digest over SMTP via
  `nodemailer` (`src/lib/email.ts`, provider-agnostic; Gmail app-password today). The
  `Notification` rows are the outbox: `emailSentAt` column marks sent; `runEmailDigest()`
  (`src/lib/email-digest.ts`) batches each opted-in user's **unread** notifications (older than
  a ~2 min grace, so an in-app read beats the email) into one email and stamps them. A
  **secret-protected** route `POST /api/cron/email-digest?key=$CRON_SECRET` (`?dry=1` to
  preview) runs it; an external cron pings it every ~5 min (cron-job.org or the committed
  `.github/workflows/email-digest.yml`). Pref: `User.emailNotifications` toggled at `/settings`.
  Wording is shared with the bell via `src/lib/notification-text.ts`. Env (see CLAUDE.md):
  `SMTP_*`, `MAIL_FROM`, `APP_URL`, `CRON_SECRET`. ⚠️ SMTP only leaves Render on a **paid** web
  service (free blocks 25/465/587).
  - **Deliverability:** emails use a named From (`APP_NAME <…>`), a `Reply-To`, and a
    `List-Unsubscribe` + one-click `List-Unsubscribe-Post` header backed by a signed,
    login-less unsubscribe endpoint `GET/POST /api/unsubscribe?token=…`
    (`src/lib/unsubscribe-token.ts`, HMAC over userId with `AUTH_SECRET`; GET shows a confirm
    page, POST flips `emailNotifications=false`). The **durable** inbox fix is sending from an
    authenticated `rekayasa.io` mailbox (Workspace DKIM/SPF/DMARC) — env-only (`SMTP_USER`/
    `MAIL_FROM`), no code change. Sending from a bare `@gmail.com` address tends to spam-folder.
- **Phase C — WhatsApp (LIVE, v0.3.0).** Via **Kapso** (`kapso.com`) over Meta's **official
  WhatsApp Business Cloud API** → no account-ban risk. `src/lib/whatsapp.ts`
  `sendWhatsApp(phone, params)` POSTs a template message
  (`POST api.kapso.ai/meta/whatsapp/v24.0/{KAPSO_PHONE_NUMBER_ID}/messages`, `X-API-Key`;
  positional params fill `{{1}}`=actor+action+title, `{{2}}`=task link). `src/lib/whatsapp-dispatch.ts`
  `runWhatsAppDispatch()` sends one message per unread, opted-in notification (2-min grace +
  `Notification.whatsappSentAt` outbox marker), called from the **same cron route** as the email
  digest. Prefs `User.phone` + `User.whatsappNotifications` at `/settings`; bulk-load via
  `npm run db:import-phones -- <csv>`. Env: `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`,
  `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG` (default en_US). Requires a **Meta-approved
  Utility template** and a WhatsApp Business Account with a **payment method** (to leave test mode).
  ⚠️ When enabling the channel on existing users, backfill first
  (`UPDATE "Notification" SET "whatsappSentAt"=now() WHERE "whatsappSentAt" IS NULL;`) so the old
  unread backlog isn't blasted out.
