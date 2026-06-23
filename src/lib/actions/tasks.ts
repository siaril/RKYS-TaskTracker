"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess, atLeast, type SessionUser } from "@/lib/access";

export type FormState = { error?: string } | undefined;

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
type Priority = (typeof PRIORITIES)[number];

function str(v: FormDataEntryValue | null): string {
  return (typeof v === "string" ? v : "").trim();
}
function priorityOf(v: string): Priority {
  return (PRIORITIES as readonly string[]).includes(v) ? (v as Priority) : "MEDIUM";
}
function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

async function canEditProject(projectId: string, user: SessionUser): Promise<boolean> {
  const access = await getProjectAccess(projectId, user);
  return !!access && atLeast(access.role, "EDITOR");
}

export async function createTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const projectId = str(formData.get("projectId"));
  const title = str(formData.get("title"));
  const description = str(formData.get("description"));
  const statusId = str(formData.get("statusId"));
  const priority = priorityOf(str(formData.get("priority")));
  const assigneeId = str(formData.get("assigneeId")) || null;
  const dueDate = parseDate(str(formData.get("dueDate")));

  if (!projectId) return { error: "Missing project." };
  if (!(await canEditProject(projectId, user))) {
    return { error: "You don't have permission to add tasks here." };
  }
  if (!title) return { error: "Title is required." };

  // status must belong to this project
  const status = await prisma.workflowStatus.findFirst({
    where: { id: statusId, projectId },
    select: { id: true },
  });
  if (!status) return { error: "Please choose a valid status." };

  const position = await prisma.task.count({ where: { projectId, statusId } });

  await prisma.task.create({
    data: {
      projectId,
      title,
      description: description || null,
      statusId,
      priority,
      assigneeId,
      ownerId: user.id,
      dueDate,
      position,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?toast=created`);
}

export async function updateTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = str(formData.get("id"));
  if (!id) return { error: "Missing task." };

  const task = await prisma.task.findUnique({ where: { id }, select: { projectId: true } });
  if (!task) return { error: "Task not found." };
  if (!(await canEditProject(task.projectId, user))) {
    return { error: "You don't have permission to edit this task." };
  }

  const title = str(formData.get("title"));
  const description = str(formData.get("description"));
  const statusId = str(formData.get("statusId"));
  const priority = priorityOf(str(formData.get("priority")));
  const assigneeId = str(formData.get("assigneeId")) || null;
  const dueDate = parseDate(str(formData.get("dueDate")));

  if (!title) return { error: "Title is required." };
  const status = await prisma.workflowStatus.findFirst({
    where: { id: statusId, projectId: task.projectId },
    select: { id: true },
  });
  if (!status) return { error: "Please choose a valid status." };

  await prisma.task.update({
    where: { id },
    data: { title, description: description || null, statusId, priority, assigneeId, dueDate },
  });

  revalidatePath(`/projects/${task.projectId}`);
  redirect(`/projects/${task.projectId}?toast=saved`);
}

/** Board drag: move a task to another status column (appended to the end). */
export async function moveTask(input: {
  taskId: string;
  projectId: string;
  toStatusId: string;
}): Promise<void> {
  const user = await requireUser();
  if (!(await canEditProject(input.projectId, user))) return;

  const status = await prisma.workflowStatus.findFirst({
    where: { id: input.toStatusId, projectId: input.projectId },
    select: { id: true },
  });
  if (!status) return;

  // Make sure the task belongs to this project before moving it.
  const task = await prisma.task.findFirst({
    where: { id: input.taskId, projectId: input.projectId },
    select: { id: true },
  });
  if (!task) return;

  const position = await prisma.task.count({
    where: { projectId: input.projectId, statusId: input.toStatusId },
  });
  await prisma.task.update({
    where: { id: input.taskId },
    data: { statusId: input.toStatusId, position },
  });
  revalidatePath(`/projects/${input.projectId}`);
}

export async function deleteTask(formData: FormData) {
  const user = await requireUser();
  const id = str(formData.get("id"));
  if (!id) return;

  const task = await prisma.task.findUnique({ where: { id }, select: { projectId: true } });
  if (!task) redirect("/projects");
  if (!(await canEditProject(task.projectId, user))) {
    redirect(`/projects/${task.projectId}`);
  }

  await prisma.task.delete({ where: { id } });
  revalidatePath(`/projects/${task.projectId}`);
  redirect(`/projects/${task.projectId}?toast=deleted`);
}
