"use server";

import sanitizeHtml from "sanitize-html";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess, atLeast } from "@/lib/access";
import type { CommentDTO } from "@/lib/comment-types";

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "u", "s", "a", "ul", "ol", "li",
    "h1", "h2", "h3", "blockquote", "code", "pre", "img",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt"],
  },
  // Links: only safe schemes. Images: http(s) or our relative /uploads paths.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
  },
};

function clean(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTS);
}

function hasContent(cleanHtml: string): boolean {
  if (/<img\b/i.test(cleanHtml)) return true;
  return sanitizeHtml(cleanHtml, { allowedTags: [], allowedAttributes: {} }).trim().length > 0;
}

export async function addComment(input: { taskId: string; bodyHtml: string }): Promise<{ error?: string }> {
  const user = await requireUser();
  const task = await prisma.task.findUnique({
    where: { id: input.taskId },
    select: { projectId: true },
  });
  if (!task) return { error: "Task not found." };

  const access = await getProjectAccess(task.projectId, user);
  if (!access) return { error: "You don't have access to this task." };

  const bodyHtml = clean(input.bodyHtml);
  if (!hasContent(bodyHtml)) return { error: "Comment is empty." };

  await prisma.comment.create({
    data: { taskId: input.taskId, authorId: user.id, bodyHtml },
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

  const canModerate = atLeast(access.role, "OWNER");
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
  const isAuthor = comment.authorId === user.id;
  const canModerate = !!access && atLeast(access.role, "OWNER");
  if (!isAuthor && !canModerate) return;

  await prisma.comment.delete({ where: { id } });
  revalidatePath(`/projects/${comment.task.projectId}/tasks/${comment.task.id}`);
}
