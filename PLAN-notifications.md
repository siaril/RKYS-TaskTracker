# Plan — Notifications

> **For the implementing agent:** Read [`HANDOFF.md`](HANDOFF.md) first — repo
> architecture, coding patterns, git/branch workflow, the verification standard, and the
> memory/OOM safety rules. Also [`CLAUDE.md`](CLAUDE.md) (run + secrets) and
> [`docs/ACCESS.md`](docs/ACCESS.md) (roles).
>
> **Critical gotchas:**
> - `npm run dev` **only** through the supervisor; one server at a time (OOM rule). If the
>   build-worker fork bomb appears, `rm -rf .next` and retry (predev now auto-clears a
>   corrupt cache after an unclean exit).
> - Commit with `git commit -F <file>` (PowerShell breaks on inner double-quotes in `-m`).
> - Merging to `main` **auto-deploys to Render** (prod is live; team uses it). The Render
>   start command runs `prisma migrate deploy && db:seed` — so a new migration applies on
>   deploy. Push the branch, let the human verify, then merge.
> - File uploads must NOT go through a Server Action (1MB cap) — not relevant here, noted
>   for context.

## Goal
Notify a user when:
1. A task is **assigned** to them.
2. They're **@mentioned in a task description**.
3. They're **@mentioned in a comment**.
4. A **comment is added to a task they're assigned to**.
5. A **comment is added to a task they own/created**.

Three delivery channels: **(1) in-app**, **(2) email**, **(3) WhatsApp**. Built in three
phases — Phase A is the whole of this PLAN's detailed scope; B and C are outlined for
follow-up branches.

## Decisions (confirmed with the human, 2026-06-25)
- **Sequence:** Phase A (in-app) first — no external dependencies. Email and WhatsApp are
  separate later branches.
- **Email (Phase B):** SMTP from the **paid Render** web service (465/587 are open on paid;
  port 25 is blocked everywhere). NOTE: Render does **not** provide a mail server — "SMTP on
  Render" still means an **external SMTP provider** (e.g. SendGrid/Mailgun/SES/Resend SMTP
  creds), just reached over SMTP from the Render service.
- **WhatsApp (Phase C):** self-hosted **GOWA** (`aldinokemal/go-whatsapp-web-multidevice`) —
  lightweight Go gateway, link a number via QR, POST to its REST API. Unofficial → real
  **account-ban risk**; keep all sends behind a `sendWhatsApp()` abstraction so we can swap
  to the official WhatsApp Business Cloud API later.

---

# Phase A — In-app notifications (this branch: `feat/notifications-inapp`)

## Schema (`prisma/schema.prisma`)
```prisma
enum NotificationType {
  TASK_ASSIGNED
  MENTIONED_IN_DESCRIPTION
  MENTIONED_IN_COMMENT
  COMMENT_ON_ASSIGNED_TASK
  COMMENT_ON_OWNED_TASK
}

model Notification {
  id        String           @id @default(cuid())
  userId    String           // recipient
  actorId   String           // who triggered it (never == userId)
  type      NotificationType
  taskId    String
  projectId String
  commentId String?          // set for the comment-related types
  readAt    DateTime?
  createdAt DateTime         @default(now())

  user  User    @relation("NotificationUser", fields: [userId], references: [id], onDelete: Cascade)
  actor User    @relation("NotificationActor", fields: [actorId], references: [id], onDelete: Cascade)
  task  Task    @relation(fields: [taskId], references: [id], onDelete: Cascade)
  comment Comment? @relation(fields: [commentId], references: [id], onDelete: Cascade)

  @@index([userId, readAt])
  @@index([userId, createdAt])
}
```
Add the back-relations on `User`/`Task`/`Comment`. `npm run db:migrate -- --name add_notifications`
→ `npm run db:generate`. No backfill.

## Helpers
- **`src/lib/mentions-extract.ts`** — `extractMentionIds(html: string): string[]`: regex over
  the mention spans (`<span data-type="mention" data-id="…">`) → unique user ids. (Mentions are
  always project members, since the `@` picker is scoped to members.)
- **`src/lib/actions/notify.ts`** (server, NOT a `"use server"` action file — a plain server
  module) — `notify(input: { actorId; taskId; projectId; commentId?; candidates: {userId, type}[] })`:
  1. Drop any candidate whose `userId === actorId` (**never self-notify**).
  2. **Dedup per userId**, keeping the highest-priority type:
     `MENTIONED_IN_COMMENT > MENTIONED_IN_DESCRIPTION > TASK_ASSIGNED > COMMENT_ON_ASSIGNED_TASK > COMMENT_ON_OWNED_TASK`.
  3. `prisma.notification.createMany(...)`.
  Keep it best-effort: wrap in try/catch so a notification failure never breaks the user's
  action.

## Trigger wiring (call `notify` right after each successful DB write)
- **`createTask`** (`src/lib/actions/tasks.ts`): candidates = (assignee → `TASK_ASSIGNED`) +
  (description mention ids → `MENTIONED_IN_DESCRIPTION`).
- **`updateTask`**: assignee → `TASK_ASSIGNED` **only when it changed to a new user**; description
  mentions → only the **newly added** ids (current minus `old.description`'s ids), so editing a
  task doesn't re-notify everyone.
- **`assignToMe`**: **no notification** (actor assigns self).
- **`addComment`** (`src/lib/actions/comments.ts`): candidates = (comment mention ids →
  `MENTIONED_IN_COMMENT`) + (task.assigneeId → `COMMENT_ON_ASSIGNED_TASK`) +
  (task.ownerId → `COMMENT_ON_OWNED_TASK`). Dedup handles the overlap (one row per person).
- **`moveTask` / status changes:** no notification in v1 (not in the 5 triggers).

## In-app UI
- **`src/lib/actions/notifications.ts`** (`"use server"`): `getNotifications()` (recent ~20 for
  the current user, newest first, joined with actor name/image + task title + projectId),
  `getUnreadCount()`, `markNotificationRead(id)`, `markAllNotificationsRead()`.
- **`src/components/notification-bell.tsx`** (client): a **bell icon in the top-right header,
  beside the user menu** (`src/app/(app)/layout.tsx`), with an unread **count badge**. Click →
  a dropdown panel listing notifications: actor avatar + a message line built from `type`
  (e.g. "**Maria** mentioned you in *Fix login*"), relative time, unread dot. Clicking a row
  **marks it read and navigates to** `/projects/{projectId}/tasks/{taskId}`. Include a
  "Mark all as read" action and an empty state.
- **Freshness:** light **polling** — the bell calls `getUnreadCount()` on an interval
  (~45–60s) and refetches the list when opened. (SSE/real-time is a later upgrade; not v1.)
- Message text builder: a small `notificationText(type, actorName, taskTitle)` used by the UI.

## Verification (all three, per repo standard)
- `npx tsc --noEmit` clean.
- Throwaway `prisma/smoke.ts` (self-cleaning): create 2 temp users + project + task; (a) assign
  the task to user B as user A → assert one `TASK_ASSIGNED` row for B, none for A; (b) add a
  comment as A that @mentions B on a task B is assigned to → assert **exactly one** row for B
  with type `MENTIONED_IN_COMMENT` (dedup, not three); (c) comment as the assignee on their own
  task → assert no self-notification. Delete the file after.
- One supervised `npm run dev` probe: routes compile (unauth → 307). Then the **human** logs in,
  gets assigned/mentioned/commented from another account, and confirms the bell count + list +
  click-through + mark-read.
- Commit (`git commit -F`), push `feat/notifications-inapp`. **Stop — human verifies before merge.**

## What's-new
Add a 0.2.x (or next) release-notes entry in `src/lib/releases.ts` for in-app notifications.

---

# Phase B — Email (later branch: `feat/notifications-email`)
- **Prefs:** add `User.emailNotifications Boolean @default(true)` (+ a "Notifications" settings
  section to toggle it).
- **Outbox pattern:** add `emailSentAt DateTime?` to `Notification`. A **Render Cron Job** (or a
  small background worker service) scans rows where `emailSentAt IS NULL` and `readAt IS NULL`
  older than a short grace period, **batches per user into a digest** ("You have N new
  notifications"), sends, and stamps `emailSentAt`. This keeps user actions fast, survives
  restarts, and avoids one-email-per-event spam.
- **Sending:** `src/lib/email.ts` via `nodemailer` over SMTP. Env: `SMTP_HOST`, `SMTP_PORT=587`,
  `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. Provider supplies the SMTP creds; **verify the sending
  domain** (SPF/DKIM on `rekayasa.io`) for deliverability. Works on the paid Render plan
  (465/587 open; port 25 blocked).
- Simple HTML template; link straight to the task.

# Phase C — WhatsApp (later branch: `feat/notifications-whatsapp`)
- **Gateway:** stand up **GOWA** (Docker) — a separate Render Docker service or a small VPS (a
  VPS is often simpler for the one-time QR link + persistent session storage). Link a dedicated
  WhatsApp number; persist the session on a disk/volume.
- **Prefs/contact:** `User.phone String?` + `User.whatsappNotifications Boolean @default(false)`
  + phone entry in the Notifications settings section (opt-in).
- **Sending:** `src/lib/whatsapp.ts` → `sendWhatsApp(phone, text)` POSTs to GOWA `/send/message`.
  Env: `GOWA_URL`, `GOWA_BASIC_AUTH`. The outbox worker (from Phase B) also dispatches WhatsApp
  for opted-in users (add `whatsappSentAt`).
- ⚠️ **Ban risk** (unofficial WhatsApp Web automation): keep volume low, only opted-in internal
  users, behind the `sendWhatsApp()` abstraction so swapping to the official **WhatsApp Business
  Cloud API** later is a one-file change.

## Research notes / sources
- Render SMTP: free web services block outbound SMTP (25/465/587) since 2025-09-26; **paid**
  unblocks 465/587; port 25 blocked for all. Render provides no mail server →
  [Render changelog](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports).
- GOWA — [github.com/aldinokemal/go-whatsapp-web-multidevice](https://github.com/aldinokemal/go-whatsapp-web-multidevice).
- WAHA (alternative) — [waha.devlike.pro](https://waha.devlike.pro/).
