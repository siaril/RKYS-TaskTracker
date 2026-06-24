"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess, isAdmin } from "@/lib/access";
import { cleanHtml, hasHtmlContent } from "@/lib/sanitize";
import type { CommentDTO, CommentNode } from "@/lib/comment-types";

export async function addComment(input: {
  taskId: string;
  bodyHtml: string;
  parentId?: string | null;
}): Promise<{ error?: string }> {
  const user = await requireUser();
  const task = await prisma.task.findUnique({
    where: { id: input.taskId },
    select: { projectId: true },
  });
  if (!task) return { error: "Task not found." };

  const access = await getProjectAccess(task.projectId, user);
  if (!access) return { error: "You don't have access to this task." };

  const bodyHtml = cleanHtml(input.bodyHtml);
  if (!hasHtmlContent(bodyHtml)) return { error: "Comment is empty." };

  // Flatten replies: if parentId is given, resolve the top-level parent so
  // a reply-to-reply always nests under the thread root (single-level threading).
  let resolvedParentId: string | null = null;
  if (input.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: input.parentId },
      select: { id: true, taskId: true, parentId: true },
    });
    if (!parent) return { error: "Parent comment not found." };
    if (parent.taskId !== input.taskId)
      return { error: "Parent comment belongs to a different task." };
    resolvedParentId = parent.parentId ?? parent.id;
  }

  await prisma.comment.create({
    data: {
      taskId: input.taskId,
      authorId: user.id,
      bodyHtml,
      parentId: resolvedParentId,
    },
  });
  await prisma.taskActivity.create({
    data: { taskId: input.taskId, userId: user.id, type: "COMMENTED" },
  });
  revalidatePath(`/projects/${task.projectId}/tasks/${input.taskId}`);
  return {};
}

/** Fetch a task's comments, returning threaded CommentNode[] (top-level +
 *  single-level nested replies). Access-checked. */
export async function getTaskComments(
  taskId: string,
): Promise<{ comments?: CommentNode[]; error?: string }> {
  const user = await requireUser();
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!task) return { error: "Task not found." };
  const access = await getProjectAccess(task.projectId, user);
  if (!access) return { error: "No access." };

  const canModerate = isAdmin(user);
  const rows = await prisma.comment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, email: true, image: true } } },
  });

  // Build DTOs
  const all: (CommentDTO & { parentId: string | null })[] = rows.map((c) => ({
    id: c.id,
    parentId: c.parentId,
    authorName: c.author.name ?? c.author.email ?? "User",
    authorImage: c.author.image,
    createdAt: c.createdAt.toISOString(),
    bodyHtml: c.bodyHtml,
    canDelete: c.author.id === user.id || canModerate,
  }));

  // Partition into top-level (parentId null) and replies (parentId set)
  const topLevel: CommentNode[] = [];
  const replyMap = new Map<string, CommentDTO[]>();

  for (const dto of all) {
    if (dto.parentId === null) {
      topLevel.push({ ...dto, replies: [] });
    } else {
      const arr = replyMap.get(dto.parentId);
      if (arr) {
        arr.push(dto);
      } else {
        replyMap.set(dto.parentId, [dto]);
      }
    }
  }

  // Attach sorted replies to their top-level parent
  for (const node of topLevel) {
    node.replies = replyMap.get(node.id) ?? [];
  }

  return { comments: topLevel };
}

export async function deleteComment(formData: FormData) {
  const user = await requireUser();
  const id = typeof formData.get("id") === "string" ? (formData.get("id") as string) : "";
  if (!id) return;

  const comment = await prisma.comment.findUnique({
    where: { id },
    include: { task: { select: { id: true, projectId: true } } },
  });
  if (!comment) return;

  const access = await getProjectAccess(comment.task.projectId, user);
  if (!access) return; // must still have project access at all
  const isAuthor = comment.authorId === user.id;
  const canModerate = isAdmin(user);
  if (!isAuthor && !canModerate) return;

  await prisma.comment.delete({ where: { id } });
  await prisma.taskActivity.create({
    data: { taskId: comment.task.id, userId: user.id, type: "COMMENT_DELETED" },
  });
  revalidatePath(`/projects/${comment.task.projectId}/tasks/${comment.task.id}`);
}
