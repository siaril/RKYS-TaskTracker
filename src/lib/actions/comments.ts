"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess, isAdmin } from "@/lib/access";
import { cleanHtml, hasHtmlContent } from "@/lib/sanitize";
import type { CommentDTO } from "@/lib/comment-types";

export async function addComment(input: { taskId: string; bodyHtml: string }): Promise<{ error?: string }> {
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

  await prisma.comment.create({
    data: { taskId: input.taskId, authorId: user.id, bodyHtml },
  });
  await prisma.taskActivity.create({
    data: { taskId: input.taskId, userId: user.id, type: "COMMENTED" },
  });
  revalidatePath(`/projects/${task.projectId}/tasks/${input.taskId}`);
  return {};
}

/** Fetch a task's comments for the on-board drawer (access-checked). */
export async function getTaskComments(
  taskId: string,
): Promise<{ comments?: CommentDTO[]; error?: string }> {
  const user = await requireUser();
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!task) return { error: "Task not found." };
  const access = await getProjectAccess(task.projectId, user);
  if (!access) return { error: "No access." };

  // A comment is deletable only by its author or a global admin.
  const canModerate = isAdmin(user);
  const comments = await prisma.comment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, email: true, image: true } } },
  });
  return {
    comments: comments.map((c) => ({
      id: c.id,
      authorName: c.author.name ?? c.author.email ?? "User",
      authorImage: c.author.image,
      createdAt: c.createdAt.toISOString(),
      bodyHtml: c.bodyHtml,
      canDelete: c.author.id === user.id || canModerate,
    })),
  };
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
