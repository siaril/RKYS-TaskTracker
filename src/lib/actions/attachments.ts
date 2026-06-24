"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess, canModifyTask, isAdmin } from "@/lib/access";
import { isBlockedFile } from "@/lib/uploads";

export type RecordAttachmentInput = {
  taskId: string;
  storedName: string;
  filename: string;
  mimeType: string;
  size: number;
};

/** Record an already-uploaded file (via /api/upload) as a task attachment. The
 *  file body goes through the upload route — not this action — to avoid the
 *  Server Actions body-size limit. Allowed for anyone who can modify the task. */
export async function recordTaskAttachment(
  input: RecordAttachmentInput,
): Promise<{ error?: string }> {
  const user = await requireUser();
  const { taskId, storedName, filename, mimeType, size } = input;
  if (!taskId || !storedName || !filename) return { error: "Missing attachment data." };
  if (isBlockedFile(filename, mimeType)) return { error: "That file type isn't allowed." };
  // storedName must be a plain disk name produced by the upload route.
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(storedName) && !/^[A-Za-z0-9_-]+$/.test(storedName)) {
    return { error: "Invalid file reference." };
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, ownerId: true, assigneeId: true },
  });
  if (!task) return { error: "Task not found." };
  const access = await getProjectAccess(task.projectId, user);
  if (!access || !canModifyTask(access, { ownerId: task.ownerId, assigneeId: task.assigneeId }, user.id)) {
    return { error: "You don't have permission to attach files to this task." };
  }

  await prisma.attachment.create({
    data: {
      taskId,
      uploaderId: user.id,
      filename,
      storedName,
      mimeType: mimeType || "application/octet-stream",
      size: Number.isFinite(size) ? size : 0,
    },
  });
  await prisma.taskActivity.create({
    data: { taskId, userId: user.id, type: "UPDATED", field: "attachment", newValue: filename },
  });

  revalidatePath(`/projects/${task.projectId}/tasks/${taskId}`);
  return {};
}

/** Remove a task attachment. Allowed for the uploader, or anyone who can modify the task. */
export async function deleteTaskAttachment(formData: FormData) {
  const user = await requireUser();
  const id = typeof formData.get("id") === "string" ? (formData.get("id") as string) : "";
  if (!id) return;

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { task: { select: { id: true, projectId: true, ownerId: true, assigneeId: true } } },
  });
  if (!attachment) return;

  const access = await getProjectAccess(attachment.task.projectId, user);
  const isUploader = attachment.uploaderId === user.id;
  const canManage =
    !!access &&
    (isAdmin(user) ||
      canModifyTask(access, { ownerId: attachment.task.ownerId, assigneeId: attachment.task.assigneeId }, user.id));
  if (!isUploader && !canManage) return;

  await prisma.attachment.delete({ where: { id } });
  // Best-effort: remove the file from disk (ignore if already gone).
  try {
    await unlink(path.join(process.cwd(), "public", "uploads", attachment.storedName));
  } catch {
    /* ignore */
  }
  await prisma.taskActivity.create({
    data: {
      taskId: attachment.task.id,
      userId: user.id,
      type: "UPDATED",
      field: "attachment",
      oldValue: attachment.filename,
    },
  });

  revalidatePath(`/projects/${attachment.task.projectId}/tasks/${attachment.task.id}`);
}
