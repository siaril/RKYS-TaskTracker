# Rekayasa Task Tracker

An internal, team Kanban task tracker — web-based, mobile-friendly, styled after
monday.com. Projects hold tasks on a drag-and-drop board with configurable workflow
columns, rich comments, file attachments, role-based access, and multi-channel
notifications (in-app, email, WhatsApp).

- **Live:** https://tasktracker.rekayasa.io
- **Sign-in:** Google only, restricted to an allowlist of team members.

> **Contributing / working on the code?** Read [`HANDOFF.md`](HANDOFF.md) — it's the
> architecture + conventions + Git-workflow guide. This README is the high-level overview.

---

## Features

**Projects & board**
- Catalog: **Clients → Products → Projects → Tasks**. A project belongs to one client and
  uses one or more products.
- **Kanban board** with per-project, configurable **workflow columns**. Desktop uses
  drag-and-drop; on phones the board becomes **status tabs + a "Move" button** (no clumsy
  dragging).
- Tasks have title, rich description, **priority**, **due date**, **assignee**, and **tags**.
- **"Assign to me"** to take over a task.

**Rich content**
- Task descriptions and comments use a **Tiptap** WYSIWYG editor (paste images, links,
  formatting). Inline images are **click-to-zoom**.
- **@mentions** of project members in comments and descriptions.
- **Threaded comment replies.**
- **File attachments** on tasks.

**Safe delete & roles**
- Deleting a task moves it to a per-project **Deleted column** (owner-only, restorable) —
  nothing is hard-deleted.
- **Global roles:** ADMIN / MEMBER. **Per-project roles:** OWNER / EDITOR / VIEWER. Full
  matrix in [`docs/ACCESS.md`](docs/ACCESS.md).

**Dashboard & activity**
- **My Tasks** dashboard: your assigned tasks across all projects, sorted by priority/due
  date, with an urgent "hell mode" alert.
- **Project Activity** tab: a filterable log of everything in a project (by user, task, and
  activity type).

**Notifications** — 5 triggers (assigned, @mentioned in a description, @mentioned in a
comment, comment on a task you're assigned to, comment on a task you own) across **3
channels**, each toggleable per-user in **Settings**:
- **In-app** bell (top bar, unread badge).
- **Email** digest (SMTP via `nodemailer`).
- **WhatsApp** (official WhatsApp Cloud API via [Kapso](https://kapso.com)).

**Other**
- **Dark mode** (per-user, follows you across devices).
- In-app **version badge** + **"What's new"** popup, driven by
  [`src/lib/releases.ts`](src/lib/releases.ts).

---

## Tech stack

- **Next.js 16** (App Router, TypeScript, `src/` dir, `@/*` import alias)
- **PostgreSQL** via **Prisma 7** + `@prisma/adapter-pg`
- **Auth.js (NextAuth v5)** — Google sign-in, allowlisted
- **Tailwind CSS v4** (theme tokens in `src/app/globals.css`)
- **Tiptap** (rich text), **dnd-kit** (board drag-and-drop)
- **nodemailer** (email), **Kapso / WhatsApp Cloud API** (WhatsApp)
- Deployed on **Render.com**

---

## Where the code is

```
src/
  app/
    (app)/                     Protected pages (layout runs requireUser() → redirects to /signin)
      dashboard/               "My Tasks"
      projects/                Project list, board [id], settings, activity, tasks/[taskId], new
      clients/  products/  users/   Admin-only catalog + allowlist management
      settings/                Per-user notification prefs (email, WhatsApp, phone)
    signin/                    Public sign-in
    api/                       Route handlers: auth, upload, files, attachments,
                               cron/email-digest (email + WhatsApp dispatch), unsubscribe
  lib/
    prisma.ts                  Prisma singleton (globalThis — do not bypass)
    session.ts  access.ts      requireUser()/requireAdmin(); role helpers (OWNER/EDITOR/VIEWER)
    actions/*                  Server actions (mutations) — tasks, comments, projects, members,
                               statuses, users, settings, auth, attachments, notifications…
    notify.ts                  Creates Notification rows for the 5 triggers
    email.ts / email-digest.ts        Email sending + digest outbox worker
    whatsapp.ts / whatsapp-dispatch.ts  WhatsApp sending + dispatch worker
    notification-text.ts       Shared notification wording (bell + email + WhatsApp)
    sanitize.ts  uploads.ts  format.ts  releases.ts  …
  components/                  UI: board (tasks/), comments/, editor/, notification-bell,
                               whats-new, theme-toggle, whatsapp-settings, sidebar, …
prisma/
  schema.prisma               Data model (grows per feature)
  migrations/                 Applied on deploy via `prisma migrate deploy`
  seed.ts  team-users.ts      Seeds clients/products + the login allowlist
  add-user.ts                 Add a user to the allowlist (`npm run db:add-user`)
  import-phones.ts            Bulk-load WhatsApp phones from CSV (`npm run db:import-phones`)
scripts/
  dev.mjs / predev.mjs        Memory-aware dev supervisor (see OOM rules in CLAUDE.md)
  release-notes.ts            Prints a WhatsApp-ready release announcement
```

---

## Running locally

**Prerequisites:** Node.js, and a local PostgreSQL with a database named `tasktracker`.

1. **Environment** — create `.env` (gitignored). The full list of variables and how to
   obtain each is in [`CLAUDE.md`](CLAUDE.md) → *Secrets*. At minimum you need
   `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`. Email and
   WhatsApp vars are optional locally.
2. **Install & set up the DB:**
   ```bash
   npm install
   npm run db:migrate      # apply schema
   npm run db:seed         # clients/products + login allowlist
   ```
3. **Run:**
   ```bash
   npm run dev             # http://localhost:3000
   ```

> ⚠️ **`npm run dev` runs through a memory-aware supervisor** that kills the server if RAM
> spikes, so a runaway build can't crash the machine. Details and the rest of the memory
> rules are in [`CLAUDE.md`](CLAUDE.md). Use `npm run kill-dev` to stop a stray server.

**Useful scripts:** `db:migrate`, `db:generate`, `db:seed`, `db:studio` (browse data),
`db:add-user`, `db:import-phones`, `release-notes`.

---

## Deployment

Hosted on **Render.com** from [`render.yaml`](render.yaml). **Merging to `main`
auto-deploys.** The build runs `prisma generate` + `next build`; the start command runs
`prisma migrate deploy` (applies pending migrations) + `db:seed`, then serves.

Step-by-step setup, env vars to set in the Render dashboard, the digest cron, and the
uploads disk are in [`DEPLOY.md`](DEPLOY.md).

---

## Documentation map

| Doc | What it covers |
|-----|----------------|
| [`README.md`](README.md) | This overview — features, structure, run, deploy. |
| [`CLAUDE.md`](CLAUDE.md) | How to run, the full **secrets/env** list, and the **memory/OOM safety rules**. |
| [`HANDOFF.md`](HANDOFF.md) | Contributor guide: architecture, data model, coding patterns, Git/branch workflow, verification standard, feature history. |
| [`DEPLOY.md`](DEPLOY.md) | Deploying to Render (services, env, cron, uploads). |
| [`docs/ACCESS.md`](docs/ACCESS.md) | Roles & permissions matrix. |
| [`AGENTS.md`](AGENTS.md) | Entry point for AI coding agents. |
