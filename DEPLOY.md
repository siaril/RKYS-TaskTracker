# Deploying to Render.com

## 1. Create the services (Blueprint — easiest)
1. Push to GitHub (already done).
2. In Render: **New → Blueprint**, connect the `RKYS-TaskTracker` repo.
3. Render reads `render.yaml` and provisions a **Postgres DB** + the **web service**,
   auto-linking `DATABASE_URL` and generating `AUTH_SECRET`.

## 2. Set the environment variables
On the web service → **Environment**, fill in (`DATABASE_URL` and `AUTH_SECRET` are set
automatically by the blueprint). Full descriptions of every variable are in
[`CLAUDE.md`](CLAUDE.md) → *Secrets*.

**Auth (required):**
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (from Google Cloud Console).
- (optional) `AUTH_URL` = `https://<your-app>.onrender.com` / your custom domain.

**Email notifications (optional):** `APP_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, `MAIL_FROM`, `CRON_SECRET`. (SMTP only works on a **paid** web service — free
Render blocks SMTP ports.)

**WhatsApp notifications (optional):** `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`,
`WHATSAPP_TEMPLATE_NAME`, and `WHATSAPP_TEMPLATE_LANG` if the approved template isn't
`en_US`.

> Env vars set locally in `.env` are **not** shared with Render — set them here too.

## 3. First deploy
Build runs `prisma generate` + `next build`. Start runs `prisma migrate deploy`
(creates the schema) + `db:seed` (clients, products, and the **team allowlist**),
then `next start`. Without seeding, nobody could log in — so it runs automatically.

## 4. Wire up Google OAuth for the live URL
In Google Cloud Console → Credentials → your OAuth client, add:
- Authorized JavaScript origin: `https://<your-app>.onrender.com`
- Authorized redirect URI: `https://<your-app>.onrender.com/api/auth/callback/google`
(keep the localhost entries for local dev).

## 5. Notification digest cron (email + WhatsApp)
Email digests and WhatsApp messages are sent by a scheduled ping to a protected route, not
on the request path. Point a **free external cron** at it every ~5 minutes:
- URL: `POST https://<your-app>/api/cron/email-digest` with header `x-cron-key: <CRON_SECRET>`
  (or `?key=<CRON_SECRET>`).
- Use a scheduled pinger such as **cron-job.org** (the current setup) — configure it to POST
  the URL every 5 minutes with the `x-cron-key` header.
- One tick runs **both** email and WhatsApp. Add `&dry=1` to preview without sending.

## 6. Done
Open the URL and sign in with an allowlisted Google account.

---

## Notes / current production setup
- **Plan:** both the web service and Postgres are on **paid** Render plans (no idle
  spin-down, no 90-day DB expiry, and SMTP ports open for email).
- **Uploads persist** via a **Render Disk** mounted at
  `/opt/render/project/src/public/uploads`. Uploaded images/files are served through
  `GET /api/files/[name]` (Next's static server only serves files present at *build* time,
  so runtime uploads must go through the route). An unused S3 path exists on a separate
  branch for a future object-storage migration.
- **Migrations** run on every start via `prisma migrate deploy` (applies only pending
  ones). Safe for a single instance; use a pre-deploy command if you scale to multiple.
- **WhatsApp** requires a Meta-approved template and a WhatsApp Business Account with a
  payment method (see [`HANDOFF.md`](HANDOFF.md) §13).
