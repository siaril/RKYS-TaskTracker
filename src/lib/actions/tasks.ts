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

const TAG_PALETTE = [
  "#0073ea", "#00c875", "#fdab3d", "#a25ddc", "#e2445c",
  "#579bfc", "#00c2ff", "#ff7575", "#7e5bef", "#16a34a",
];
function colorForTag(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

/** Resolve selected existing tag ids + newly-typed tag names into tag ids,
 *  creating any new tags for the project. */
async function resolveTagIds(
  projectId: string,
  formData: FormData,
): Promise<string[]> {
  const selected = formData
    .getAll("tags")
    .map((v) => (typeof v === "string" ? v : ""))
    .filter(Boolean);
  const newNames = str(formData.get("newTags"))
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  const ids = new Set<string>();
  if (selected.length) {
    const existing = await prisma.tag.findMany({
      where: { projectId, id: { in: selected } },
      select: { id: true },
    });
    for (const t of existing) ids.add(t.id);
  }
  for (const name of newNames) {
    const tag = await prisma.tag.upsert({
      where: { projectId_name: { projectId, name } },
      update: {},
      create: { projectId, name, color: colorForTag(name) },
      select: { id: true },
    });
    ids.add(tag.id);
  }
  return [...ids];
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
  const tagIds = await resolveTagIds(projectId, formData);

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
      tags: { create: tagIds.map((tagId) => ({ tagId })) },
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

  const tagIds = await resolveTagIds(task.projectId, formData);
  await prisma.task.update({
    where: { id },
    data: {
      title,
      description: description || null,
      statusId,
      priority,
      assigneeId,
      dueDate,
      tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) },
    },
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
