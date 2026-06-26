import { timingSafeEqual } from "node:crypto";
import { runEmailDigest } from "@/lib/email-digest";

// Scheduled endpoint: an external cron (cron-job.org / GitHub Action) pings this every
// few minutes to flush the notification email outbox. Protected by a shared secret, NOT
// a user session — it lives outside the (app) group so it never calls requireUser().
//   GET/POST /api/cron/email-digest?key=$CRON_SECRET   (or header: x-cron-key)
//   add ?dry=1 to plan without sending or stamping.
// nodemailer needs the Node runtime; force-dynamic so it's never cached/prerendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if unconfigured
  const url = new URL(req.url);
  const provided = url.searchParams.get("key") ?? req.headers.get("x-cron-key") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: Request): Promise<Response> {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dryRun = new URL(req.url).searchParams.has("dry");
  try {
    const result = await runEmailDigest({ dryRun });
    return Response.json({ ok: true, dryRun, ...result });
  } catch (err) {
    console.error("[cron/email-digest] failed:", err);
    return Response.json({ ok: false, error: "Digest failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
