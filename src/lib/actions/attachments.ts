"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess, canModifyTask, isAdmin } from "@/lib/access";
import { MAX_UPLOAD_BYTES, isBlockedFile, saveToDisk } from "@/lib/uploads";

export type AttachmentState = { error?: string } | undefined;

/** Upload and attach a file to a task. Allowed for anyone who can modify the task. */
export async function addTaskAttachment(
  _prev: AttachmentState,
  formData: FormData,
): Promise<AttachmentState> {
  const user = await requireUser();
  const taskId = typeof formData.get("taskId") === "string" ? (formData.get("taskId") as string) : "";
  const file = formData.get("file");
  if (!taskId) return { error: "Missing task." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to attach." };
  if (isBlockedFile(file.name, file.type)) return { error: "That file type isn't allowed." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "File too large (max 10 MB)." };

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, ownerId: true, assigneeId: true },
  });
  if (!task) return { error: "Task not found." };
  const access = await getProjectAccess(task.projectId, user);
  if (!access || !canModifyTask(access, { ownerId: task.ownerId, assigneeId: task.assigneeId }, user.id)) {
    return { error: "You don't have permission to attach files to this task." };
  }

  const { storedName } = await saveToDisk(file);
  await prisma.attachment.create({
    data: {
      taskId,
      uploaderId: user.id,
      filename: file.name,
      storedName,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    },
  });
  await prisma.taskActivity.create({
    data: { taskId, userId: user.id, type: "UPDATED", field: "attachment", newValue: file.name },
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
