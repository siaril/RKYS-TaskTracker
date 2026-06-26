import { prisma } from "@/lib/prisma";
import { sendEmail, type SendEmailInput } from "@/lib/email";
import { notificationMessage } from "@/lib/notification-text";
import { makeUnsubscribeToken } from "@/lib/unsubscribe-token";
import { APP_NAME } from "@/lib/releases";

// Outbox digest: one batched email per user covering their new, still-unread
// notifications. A short grace period lets an in-app read beat the email, so people
// don't get mailed about something they already saw in the bell.

const DEFAULT_GRACE_MS = 2 * 60 * 1000; // 2 min
const MAX_ROWS = 500; // safety cap per run

function appUrl(): string {
  return (process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type DigestItem = {
  type: string;
  taskId: string;
  projectId: string;
  taskTitle: string;
  actorName: string;
};

function buildDigestEmail(userId: string, to: string, items: DigestItem[]): SendEmailInput {
  const base = appUrl();
  const fromAddr = process.env.MAIL_FROM ?? process.env.SMTP_USER;
  const unsubUrl = `${base}/api/unsubscribe?token=${makeUnsubscribeToken(userId)}`;
  const n = items.length;
  const subject = `You have ${n} new notification${n === 1 ? "" : "s"}`;

  const lines = items.map((it) => ({
    link: `${base}/projects/${it.projectId}/tasks/${it.taskId}`,
    text: `${it.actorName} ${notificationMessage(it.type)} — ${it.taskTitle}`,
  }));

  const text =
    `${subject} in ${APP_NAME}:\n\n` +
    lines.map((l) => `• ${l.text}\n  ${l.link}`).join("\n\n") +
    `\n\nManage email notifications: ${base}/settings\nUnsubscribe: ${unsubUrl}`;

  const htmlItems = lines
    .map(
      (l) =>
        `<li style="margin:0 0 14px;line-height:1.4"><a href="${esc(l.link)}" style="color:#0073ea;text-decoration:none">${esc(l.text)}</a></li>`,
    )
    .join("");

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#323338">
  <h2 style="font-size:18px;margin:0 0 4px">${esc(subject)}</h2>
  <p style="font-size:13px;color:#676879;margin:0 0 18px">in ${esc(APP_NAME)}</p>
  <ul style="padding-left:18px;margin:0 0 24px;font-size:14px">${htmlItems}</ul>
  <p style="font-size:12px;color:#676879;border-top:1px solid #e6e9ef;padding-top:14px;margin:0">
    You're getting this because you have email notifications on.
    <a href="${esc(base)}/settings" style="color:#0073ea">Manage notifications</a> ·
    <a href="${esc(unsubUrl)}" style="color:#676879">Unsubscribe</a>.
  </p>
</div>`;

  // List-Unsubscribe (+ one-click POST) is a strong "legitimate automated mail" signal.
  const headers: Record<string, string> = {
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    "List-Unsubscribe": fromAddr
      ? `<${unsubUrl}>, <mailto:${fromAddr}?subject=Unsubscribe>`
      : `<${unsubUrl}>`,
  };

  return { to, subject, html, text, replyTo: fromAddr, headers };
}

export type PlannedEmail = { to: string; userId: string; count: number; subject: string };
export type DigestResult = {
  usersEmailed: number;
  rowsProcessed: number;
  planned: PlannedEmail[];
};

/** Scan the notification outbox and email each opted-in user a digest of their new,
 *  unread notifications. Best-effort per user. `dryRun` plans without sending/stamping. */
export async function runEmailDigest(opts?: {
  graceMs?: number;
  dryRun?: boolean;
}): Promise<DigestResult> {
  const graceMs = opts?.graceMs ?? DEFAULT_GRACE_MS;
  const dryRun = opts?.dryRun ?? false;
  const cutoff = new Date(Date.now() - graceMs);

  const rows = await prisma.notification.findMany({
    where: {
      emailSentAt: null,
      createdAt: { lt: cutoff },
      user: { emailNotifications: true },
    },
    orderBy: { createdAt: "asc" },
    take: MAX_ROWS,
    include: {
      user: { select: { id: true, email: true } },
      actor: { select: { name: true, email: true } },
      task: { select: { title: true } },
    },
  });

  // Group per recipient.
  const byUser = new Map<string, { email: string | null; rows: typeof rows }>();
  for (const r of rows) {
    const g = byUser.get(r.userId) ?? { email: r.user.email, rows: [] };
    g.rows.push(r);
    byUser.set(r.userId, g);
  }

  const planned: PlannedEmail[] = [];
  let usersEmailed = 0;
  let rowsProcessed = 0;

  for (const [userId, group] of byUser) {
    const allIds = group.rows.map((r) => r.id);
    const unread = group.rows.filter((r) => r.readAt === null);

    // Email only when there's unread activity and we have an address for them.
    if (unread.length > 0 && group.email) {
      const mail = buildDigestEmail(
        userId,
        group.email,
        unread.map((r) => ({
          type: r.type,
          taskId: r.taskId,
          projectId: r.projectId,
          taskTitle: r.task.title,
          actorName: r.actor.name ?? r.actor.email ?? "Someone",
        })),
      );
      planned.push({ to: group.email, userId, count: unread.length, subject: mail.subject });

      if (!dryRun) {
        const { ok } = await sendEmail(mail);
        // If the send failed, leave the rows unstamped so the next run retries.
        if (!ok) continue;
      }
      usersEmailed++;
    }

    // Stamp every picked row (read + unread) so it's never reprocessed.
    if (!dryRun) {
      await prisma.notification.updateMany({
        where: { id: { in: allIds } },
        data: { emailSentAt: new Date() },
      });
    }
    rowsProcessed += allIds.length;
  }

  return { usersEmailed, rowsProcessed, planned };
}
