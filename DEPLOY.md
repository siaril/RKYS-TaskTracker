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
- **Image storage is S3-compatible.** If `S3_BUCKET` + `AWS_REGION` +
  `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` are set, uploads go to S3 and are
  served (auth-gated) via `/api/files/...` — persistent across deploys. If those are
  empty, uploads fall back to local disk (fine for local dev, **ephemeral on Render**).

### Setting up AWS S3 for image uploads
1. **Create a bucket** (e.g. `rekayasa-tasktracker-uploads`) in your AWS region
   (e.g. `ap-southeast-1`). Keep **Block all public access ON** (images are served
   through the app, not publicly).
2. **Create an IAM user** (programmatic access) with a policy allowing
   `s3:PutObject` and `s3:GetObject` on `arn:aws:s3:::<bucket>/*`. Save its
   **Access key ID** and **Secret access key**.
3. Set these env vars (locally in `.env`, and on Render → Environment):
   - `S3_BUCKET` = the bucket name
   - `AWS_REGION` = e.g. `ap-southeast-1`
   - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` = from the IAM user
   - (Cloudflare R2 instead of S3? also set `S3_ENDPOINT` to your R2 endpoint.)
4. Redeploy. New screenshots now persist. (Screenshots uploaded *before* this — while
   on local-disk mode — are already gone and can't be recovered.)
- **Migrations** run on every start via `prisma migrate deploy` (only applies pending
  ones). Safe for a single instance; use a pre-deploy command if you scale to multiple.
