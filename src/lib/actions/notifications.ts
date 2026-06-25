"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type NotificationDTO = {
  id: string;
  type: string;
  taskId: string;
  projectId: string;
  taskTitle: string;
  actorName: string;
  actorImage: string | null;
  read: boolean;
  createdAt: string;
};

/** Recent notifications for the signed-in user (newest first). */
export async function getNotifications(): Promise<NotificationDTO[]> {
  const user = await requireUser();
  const rows = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      actor: { select: { name: true, email: true, image: true } },
      task: { select: { title: true } },
    },
  });
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    taskId: n.taskId,
    projectId: n.projectId,
    taskTitle: n.task.title,
    actorName: n.actor.name ?? n.actor.email ?? "Someone",
    actorImage: n.actor.image,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function getUnreadCount(): Promise<number> {
  const user = await requireUser();
  return prisma.notification.count({ where: { userId: user.id, readAt: null } });
}

export async function markNotificationRead(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
}
