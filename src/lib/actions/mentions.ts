"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess } from "@/lib/access";
import type { MentionItem } from "@/lib/mention-types";

/** Autocomplete source for @-mentions: project members the current user shares
 *  access with. Resolvable by projectId (task descriptions) or taskId (comments).
 *  Access-checked; returns [] if the caller can't see the project. */
export async function searchMentionables(input: {
  projectId?: string;
  taskId?: string;
  query: string;
}): Promise<MentionItem[]> {
  const user = await requireUser();

  let projectId = input.projectId ?? null;
  if (!projectId && input.taskId) {
    const task = await prisma.task.findUnique({
      where: { id: input.taskId },
      select: { projectId: true },
    });
    projectId = task?.projectId ?? null;
  }
  if (!projectId) return [];

  const access = await getProjectAccess(projectId, user);
  if (!access) return [];

  const q = input.query.trim();
  const members = await prisma.projectMember.findMany({
    where: {
      projectId,
      ...(q
        ? {
            user: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    select: { user: { select: { id: true, name: true, email: true, image: true } } },
    take: 8,
  });

  return members.map((m) => ({
    id: m.user.id,
    label: m.user.name ?? m.user.email ?? "User",
    image: m.user.image,
  }));
}
