# Deploying to Render.com

## 1. Create the services (Blueprint — easiest)
1. Push to GitHub (already done).
2. In Render: **New → Blueprint**, connect the `RKYS-TaskTracker` repo.
3. Render reads `render.yaml` and provisions a **Postgres DB** + the **web service**,
   auto-linking `DATABASE_URL` and generating `AUTH_SECRET`.

## 2. Set the Google secrets
On the web service → **Environment**, fill in:
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (from Google Cloud Console).
- (optional) `AUTH_URL` = `https://<your-app>.onrender.com` once you know the URL.

## 3. First deploy
Build runs `prisma generate` + `next build`. Start runs `prisma migrate deploy`
(creates the schema) + `db:seed` (clients, products, and the **team allowlist**),
then `next start`. Without seeding, nobody could log in — so it runs automatically.

## 4. Wire up Google OAuth for the live URL
In Google Cloud Console → Credentials → your OAuth client, add:
- Authorized JavaScript origin: `https://<your-app>.onrender.com`
- Authorized redirect URI: `https://<your-app>.onrender.com/api/auth/callback/google`
(keep the localhost entries for local dev).

## 5. Done
Open the URL and sign in with an allowlisted Google account.

---

## Notes / limitations
- **Free tier:** the web service sleeps after ~15 min idle (slow first request), and
  free Postgres expires after 90 days. For real team use, upgrade both to a paid plan.
- **Uploaded screenshots are NOT persistent on the free tier** — Render's filesystem
  is wiped on each deploy/restart. To keep them, either:
  - add a paid **Render Disk** mounted at `…/public/uploads`, or
  - switch image storage to object storage (Cloudflare R2 / AWS S3) — recommended for
    production (ask and this can be implemented).
- **Migrations** run on every start via `prisma migrate deploy` (only applies pending
  ones). Safe for a single instance; use a pre-deploy command if you scale to multiple.
