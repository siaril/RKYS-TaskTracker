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
src/lib/{format,default-statuses,comment-types}.ts
src/components/*           UI. Server components by default; "use client" only when needed.
src/generated/prisma/*     Generated Prisma client (GITIGNORED — run db:generate).
prisma/schema.prisma       Schema. prisma/migrations/* committed.
prisma/{seed,team-users,add-user}.ts      Seeding + allowlist scripts.
scripts/{dev,predev}.mjs   Memory-safe dev supervisor (see §8).
render.yaml, DEPLOY.md     Deployment.
```

### Data model (Prisma enums in CAPS)
User(role: ADMIN|MEMBER) · Account · Session · VerificationToken · Client · Product ·
Project · ProjectProduct · ProjectMember(role: OWNER|EDITOR|VIEWER) · WorkflowStatus ·
Task(priority: LOW|MEDIUM|HIGH|URGENT) · Tag · TaskTag · Comment ·
TaskActivity(type: CREATED|UPDATED|STATUS_CHANGED|COMMENTED).

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

## 11. Known gaps / TODO (good next tasks)
- **Uploads aren't persistent on Render free tier** (ephemeral disk) → move image
  storage to Cloudflare R2 / S3, or attach a paid Render Disk.
- **Task delete is a permanent hard delete with no confirmation** → add a confirm
  dialog and/or soft-delete (archive + restore).
- **No automated tests** yet — only typecheck + manual smoke tests. Adding Vitest/
  Playwright for access-control rules and activity logging would pay off.
- **No admin UI to manage the allowlist** — users are added via the script/seed.
- Ignore the sibling decoy folders `RKYS-TaskTracker` / `RKYS-TaskTracker2` (old
  attempts); the live project is this folder only.
