import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";
import { notificationMessage } from "@/lib/notification-text";

// WhatsApp side of the notification outbox. Unlike the email digest (batched per user), a
// template message is single-notification-shaped, so we send one message per unread
// notification. A short grace lets an in-app read beat the ping; a `whatsappSentAt` marker
// makes it idempotent. Runs from the same cron tick as the email digest.

const DEFAULT_GRACE_MS = 2 * 60 * 1000; // 2 min
const MAX_ROWS = 200; // safety cap per run

function appUrl(): string {
  return (process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
}

export type PlannedWhatsApp = { to: string; userId: string; taskId: string; body: string };
export type WhatsAppResult = {
  sent: number;
  rowsProcessed: number;
  planned: PlannedWhatsApp[];
};

/** Send a WhatsApp template for each new, still-unread notification whose recipient opted in
 *  and has a phone. Best-effort per row. `dryRun` plans without sending or stamping. */
export async function runWhatsAppDispatch(opts?: {
  graceMs?: number;
  dryRun?: boolean;
}): Promise<WhatsAppResult> {
  const graceMs = opts?.graceMs ?? DEFAULT_GRACE_MS;
  const dryRun = opts?.dryRun ?? false;
  const cutoff = new Date(Date.now() - graceMs);

  const rows = await prisma.notification.findMany({
    where: {
      whatsappSentAt: null,
      readAt: null, // if they've seen it in-app, don't WhatsApp them
      createdAt: { lt: cutoff },
      user: { whatsappNotifications: true, phone: { not: null } },
    },
    orderBy: { createdAt: "asc" },
    take: MAX_ROWS,
    include: {
      user: { select: { phone: true } },
      actor: { select: { name: true, email: true } },
      task: { select: { title: true } },
    },
  });

  const base = appUrl();
  const planned: PlannedWhatsApp[] = [];
  let sent = 0;

  for (const n of rows) {
    if (!n.user.phone) continue;
    const actorName = n.actor.name ?? n.actor.email ?? "Someone";
    const title = n.task.title.replace(/\s+/g, " ").trim(); // single line for the template
    // {{1}} = "Maya assigned you a task: Fix login"   {{2}} = task link
    const params = [
      `${actorName} ${notificationMessage(n.type)}: ${title}`,
      `${base}/projects/${n.projectId}/tasks/${n.taskId}`,
    ];
    planned.push({ to: n.user.phone, userId: n.userId, taskId: n.taskId, body: params[0] });
    if (dryRun) continue;

    const { ok } = await sendWhatsApp(n.user.phone, params);
    if (!ok) continue; // leave unstamped so the next run retries
    await prisma.notification.update({
      where: { id: n.id },
      data: { whatsappSentAt: new Date() },
    });
    sent++;
  }

  return { sent, rowsProcessed: rows.length, planned };
}
