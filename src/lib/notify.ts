import { prisma } from "@/lib/prisma";

export type NotifType =
  | "TASK_ASSIGNED"
  | "MENTIONED_IN_DESCRIPTION"
  | "MENTIONED_IN_COMMENT"
  | "COMMENT_ON_ASSIGNED_TASK"
  | "COMMENT_ON_OWNED_TASK";

// Higher index = higher priority. When one event makes a person eligible for
// several reasons (e.g. a comment that mentions you on a task you also own), we
// keep just the most specific one — a single notification, not three.
const PRIORITY: NotifType[] = [
  "COMMENT_ON_OWNED_TASK",
  "COMMENT_ON_ASSIGNED_TASK",
  "TASK_ASSIGNED",
  "MENTIONED_IN_DESCRIPTION",
  "MENTIONED_IN_COMMENT",
];

/** Create in-app notifications for an event. Best-effort: never throws into the
 *  caller (a notification failure must not break the user's action).
 *  - Excludes the actor (no self-notifications).
 *  - Collapses multiple candidates for the same user into one (highest priority). */
export async function notify(input: {
  actorId: string;
  taskId: string;
  projectId: string;
  commentId?: string | null;
  candidates: { userId: string; type: NotifType }[];
}): Promise<void> {
  try {
    const best = new Map<string, NotifType>();
    for (const c of input.candidates) {
      if (!c.userId || c.userId === input.actorId) continue;
      const cur = best.get(c.userId);
      if (!cur || PRIORITY.indexOf(c.type) > PRIORITY.indexOf(cur)) {
        best.set(c.userId, c.type);
      }
    }
    if (best.size === 0) return;

    await prisma.notification.createMany({
      data: [...best].map(([userId, type]) => ({
        userId,
        actorId: input.actorId,
        type,
        taskId: input.taskId,
        projectId: input.projectId,
        commentId: input.commentId ?? null,
      })),
    });
  } catch {
    // best-effort
  }
}
