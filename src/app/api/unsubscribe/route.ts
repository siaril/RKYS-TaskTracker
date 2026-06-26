import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

// One-click email unsubscribe (RFC 8058). The token is signed, so no login is needed.
//   GET  → a confirmation page with a button (no mutation, so link-scanners can't
//          accidentally unsubscribe people by pre-fetching the URL).
//   POST → actually turns off the user's email notifications. Mail clients hitting the
//          List-Unsubscribe-Post one-click flow send POST here; the confirmation button
//          posts here too.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(title: string, body: string, status: number): Response {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:440px;margin:64px auto;padding:0 20px;color:#323338;text-align:center">
${body}
</div>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return page("Invalid link", `<h2>Link expired or invalid</h2>
<p style="color:#676879">Manage your preferences from the app's Settings instead.</p>`, 400);
  }
  return page(
    "Unsubscribe",
    `<h2>Turn off email notifications?</h2>
<p style="color:#676879">You'll still see notifications in the app.</p>
<form method="POST" action="/api/unsubscribe?token=${encodeURIComponent(token)}">
  <button type="submit" style="margin-top:12px;background:#0073ea;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:14px;cursor:pointer">Unsubscribe</button>
</form>`,
    200,
  );
}

export async function POST(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return page("Invalid link", `<h2>Link expired or invalid</h2>`, 400);
  }
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { emailNotifications: false },
    });
  } catch {
    return page("Something went wrong", `<h2>Could not update your preferences</h2>`, 500);
  }
  return page(
    "Unsubscribed",
    `<h2>You're unsubscribed</h2>
<p style="color:#676879">You won't get notification emails anymore. You can turn them back on in Settings.</p>`,
    200,
  );
}
