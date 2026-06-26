import nodemailer, { type Transporter } from "nodemailer";
import { APP_NAME } from "@/lib/releases";

// Provider-agnostic SMTP sender. Configured for Gmail (app password) today, but any
// SMTP provider works by swapping the SMTP_* env vars — no code change.
//
// Env: SMTP_HOST, SMTP_PORT (465 = implicit TLS / secure; 587 = STARTTLS),
//      SMTP_USER, SMTP_PASS, MAIL_FROM (defaults to SMTP_USER).
//
// NOTE: Render blocks outbound SMTP on FREE web services — email only leaves the box
// once the service is on a paid plan (465/587 open there; port 25 blocked everywhere).

// Reuse one transport across hot reloads in dev (same reasoning as the Prisma singleton).
const globalForMail = globalThis as unknown as {
  mailTransport: Transporter | undefined;
};

function getTransport(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  if (globalForMail.mailTransport) return globalForMail.mailTransport;

  const port = Number(process.env.SMTP_PORT ?? 465);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 upgrades via STARTTLS
    auth: { user, pass },
  });

  if (process.env.NODE_ENV !== "production") {
    globalForMail.mailTransport = transport;
  }
  return transport;
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

/** Send one email. Best-effort: returns { ok } and never throws into the caller.
 *  No-ops (with a warning) when SMTP env is unset, so local dev without creds is fine. */
export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean }> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email] SMTP not configured (SMTP_HOST/USER/PASS) — skipping send");
    return { ok: false };
  }
  const address = process.env.MAIL_FROM ?? process.env.SMTP_USER;
  try {
    await transport.sendMail({
      // A named From ("Rekayasa Task Tracker <…>") reads as legitimate, not a raw address.
      from: address ? { name: APP_NAME, address } : undefined,
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
      html: input.html,
      headers: input.headers,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] send failed:", err);
    return { ok: false };
  }
}
