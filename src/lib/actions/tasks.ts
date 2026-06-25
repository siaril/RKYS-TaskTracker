"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  getProjectAccess,
  atLeast,
  canModifyTask,
  canDeleteTask,
  type SessionUser,
} from "@/lib/access";
import { formatDueDate } from "@/lib/format";
import { cleanHtml, hasHtmlContent } from "@/lib/sanitize";
import { notify } from "@/lib/notify";
import { extractMentionIds } from "@/lib/mentions-extract";

/** Sanitize a rich-text description; empty content becomes null. */
function cleanDescription(raw: string): string | null {
  const html = cleanHtml(raw);
  return hasHtmlContent(html) ? html : null;
}

export type FormState = { error?: string } | undefined;

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
type Priority = (typeof PRIORITIES)[number];

function prioLabel(p: string): string {
  return p.charAt(0) + p.slice(1).toLowerCase();
}

type ActivityEntry = {
  type: "CREATED" | "UPDATED" | "STATUS_CHANGED" | "COMMENTED";
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
};

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

/** Resolve the submitted tag names into tag ids, creating any that are new to
 *  the project. Names are de-duplicated case-insensitively. */
async function resolveTagIds(projectId: string, formData: FormData): Promise<string[]> {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const v of formData.getAll("tagNames")) {
    const name = (typeof v === "string" ? v : "").trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }

  const ids: string[] = [];
  for (const name of names) {
    const tag = await prisma.tag.upsert({
      where: { projectId_name: { projectId, name } },
      update: {},
      create: { projectId, name, color: colorForTag(name) },
      select: { id: true },
    });
    ids.push(tag.id);
  }
  return ids;
}

async function canEditProject(projectId: string, user: SessionUser): Promise<boolean> {
  const access = await getProjectAccess(projectId, user);
  return !!access && atLeast(access.role, "EDITOR");
}

export async function createTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const projectId = str(formData.get("projectId"));
  const title = str(formData.get("title"));
  const description = cleanDescription(str(formData.get("description")));
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

  const created = await prisma.task.create({
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
      activities: { create: { userId: user.id, type: "CREATED" } },
    },
  });
  // Notify the assignee (if any) and anyone @mentioned in the description.
  await notify({
    actorId: user.id,
    taskId: created.id,
    projectId,
    candidates: [
      ...(assigneeId ? [{ userId: assigneeId, type: "TASK_ASSIGNED" as const }] : []),
      ...extractMentionIds(description).map((userId) => ({
        userId,
        type: "MENTIONED_IN_DESCRIPTION" as const,
      })),
    ],
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?toast=created`);
}

export async function updateTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = str(formData.get("id"));
  if (!id) return { error: "Missing task." };

  const old = await prisma.task.findUnique({
    where: { id },
    select: {
      projectId: true,
      title: true,
      description: true,
      statusId: true,
      priority: true,
      assigneeId: true,
      ownerId: true,
      dueDate: true,
      status: { select: { name: true } },
      assignee: { select: { name: true, email: true } },
    },
  });
  if (!old) return { error: "Task not found." };
  const access = await getProjectAccess(old.projectId, user);
  if (!access || !canModifyTask(access, { ownerId: old.ownerId, assigneeId: old.assigneeId }, user.id)) {
    return { error: "You don't have permission to edit this task." };
  }

  const title = str(formData.get("title"));
  const description = cleanDescription(str(formData.get("description")));
  const statusId = str(formData.get("statusId"));
  const priority = priorityOf(str(formData.get("priority")));
  const assigneeId = str(formData.get("assigneeId")) || null;
  const dueDate = parseDate(str(formData.get("dueDate")));

  if (!title) return { error: "Title is required." };
  const newStatus = await prisma.workflowStatus.findFirst({
    where: { id: statusId, projectId: old.projectId },
    select: { id: true, name: true },
  });
  if (!newStatus) return { error: "Please choose a valid status." };

  // Resolve the new assignee's display name for the activity log.
  let newAssigneeLabel = "Unassigned";
  if (assigneeId) {
    const u = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { name: true, email: true },
    });
    newAssigneeLabel = u?.name ?? u?.email ?? "Unassigned";
  }
  const oldAssigneeLabel = old.assignee?.name ?? old.assignee?.email ?? "Unassigned";

  const acts: ActivityEntry[] = [];
  if (old.title !== title) {
    acts.push({ type: "UPDATED", field: "title", oldValue: old.title, newValue: title });
  }
  if ((old.description ?? "") !== (description ?? "")) {
    acts.push({ type: "UPDATED", field: "description" });
  }
  if (old.statusId !== statusId) {
    acts.push({ type: "STATUS_CHANGED", field: "status", oldValue: old.status.name, newValue: newStatus.name });
  }
  if (old.priority !== priority) {
    acts.push({ type: "UPDATED", field: "priority", oldValue: prioLabel(old.priority), newValue: prioLabel(priority) });
  }
  if ((old.assigneeId ?? null) !== assigneeId) {
    acts.push({ type: "UPDATED", field: "assignee", oldValue: oldAssigneeLabel, newValue: newAssigneeLabel });
  }
  const oldDueKey = old.dueDate ? old.dueDate.toISOString().slice(0, 10) : null;
  const newDueKey = dueDate ? dueDate.toISOString().slice(0, 10) : null;
  if (oldDueKey !== newDueKey) {
    acts.push({
      type: "UPDATED",
      field: "dueDate",
      oldValue: old.dueDate ? formatDueDate(old.dueDate) : "none",
      newValue: dueDate ? formatDueDate(dueDate) : "none",
    });
  }

  const tagIds = await resolveTagIds(old.projectId, formData);
  await prisma.task.update({
    where: { id },
    data: {
      title,
      description,
      statusId,
      priority,
      assigneeId,
      dueDate,
      tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) },
    },
  });

  if (acts.length > 0) {
    await prisma.taskActivity.createMany({
      data: acts.map((a) => ({
        taskId: id,
        userId: user.id,
        type: a.type,
        field: a.field ?? null,
        oldValue: a.oldValue ?? null,
        newValue: a.newValue ?? null,
      })),
    });
  }

  // Notify: a newly-set assignee, and anyone newly @mentioned in the description.
  const oldMentions = new Set(extractMentionIds(old.description));
  const newMentions = extractMentionIds(description).filter((m) => !oldMentions.has(m));
  await notify({
    actorId: user.id,
    taskId: id,
    projectId: old.projectId,
    candidates: [
      ...(assigneeId && assigneeId !== old.assigneeId
        ? [{ userId: assigneeId, type: "TASK_ASSIGNED" as const }]
        : []),
      ...newMentions.map((userId) => ({
        userId,
        type: "MENTIONED_IN_DESCRIPTION" as const,
      })),
    ],
  });

  revalidatePath(`/projects/${old.projectId}`);
  redirect(`/projects/${old.projectId}?toast=saved`);
}

/** Board drag: move a task to another status column (appended to the end).
 *  - Dragging INTO the Deleted column is disabled (use the Delete button).
 *  - Dragging a task OUT of Deleted is a restore (OWNER/admin only). */
export async function moveTask(input: {
  taskId: string;
  projectId: string;
  toStatusId: string;
}): Promise<void> {
  const user = await requireUser();
  const access = await getProjectAccess(input.projectId, user);
  if (!access) return;

  const status = await prisma.workflowStatus.findFirst({
    where: { id: input.toStatusId, projectId: input.projectId },
    select: { id: true, name: true, kind: true },
  });
  if (!status) return;

  // Make sure the task belongs to this project before moving it.
  const task = await prisma.task.findFirst({
    where: { id: input.taskId, projectId: input.projectId },
    select: {
      id: true,
      statusId: true,
      ownerId: true,
      assigneeId: true,
      status: { select: { name: true, kind: true } },
    },
  });
  if (!task) return;
  if (task.statusId === input.toStatusId) return; // no-op

  // Deletion only happens via the Delete button (confirmation) — not by drag.
  if (status.kind === "DELETED") return;

  const restoring = task.status.kind === "DELETED";
  if (restoring) {
    // Only OWNER/admin see the Deleted column, so only they can restore.
    if (!(access.isAdmin || access.role === "OWNER")) return;
  } else if (!canModifyTask(access, { ownerId: task.ownerId, assigneeId: task.assigneeId }, user.id)) {
    return;
  }

  const position = await prisma.task.count({
    where: { projectId: input.projectId, statusId: input.toStatusId },
  });
  await prisma.task.update({
    where: { id: input.taskId },
    data: {
      statusId: input.toStatusId,
      position,
      activities: {
        create: {
          userId: user.id,
          type: restoring ? "RESTORED" : "STATUS_CHANGED",
          field: "status",
          oldValue: task.status.name,
          newValue: status.name,
        },
      },
    },
  });
  revalidatePath(`/projects/${input.projectId}`);
}

/** "Delete" a task = move it to the project's Deleted column (no data loss).
 *  Permission: OWNER/admin any task, EDITOR own only, VIEWER none. */
export async function deleteTask(formData: FormData) {
  const user = await requireUser();
  const id = str(formData.get("id"));
  if (!id) return;

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      projectId: true,
      ownerId: true,
      statusId: true,
      status: { select: { name: true, kind: true } },
    },
  });
  if (!task) redirect("/projects");
  const access = await getProjectAccess(task.projectId, user);
  if (!access || !canDeleteTask(access, { ownerId: task.ownerId }, user.id)) {
    redirect(`/projects/${task.projectId}`);
  }
  if (task.status.kind === "DELETED") redirect(`/projects/${task.projectId}`); // already deleted

  const deletedStatus = await prisma.workflowStatus.findFirst({
    where: { projectId: task.projectId, kind: "DELETED" },
    select: { id: true, name: true },
  });
  if (!deletedStatus) redirect(`/projects/${task.projectId}`); // safety: no column

  const position = await prisma.task.count({
    where: { projectId: task.projectId, statusId: deletedStatus.id },
  });
  await prisma.task.update({
    where: { id },
    data: {
      statusId: deletedStatus.id,
      position,
      activities: {
        create: {
          userId: user.id,
          type: "DELETED",
          field: "status",
          oldValue: task.status.name,
          newValue: deletedStatus.name,
        },
      },
    },
  });
  revalidatePath(`/projects/${task.projectId}`);
  redirect(`/projects/${task.projectId}?toast=deleted`);
}

/** Restore a deleted task to the first normal column. OWNER/admin only. */
export async function restoreTask(formData: FormData) {
  const user = await requireUser();
  const id = str(formData.get("id"));
  if (!id) return;

  const task = await prisma.task.findUnique({
    where: { id },
    select: { projectId: true, status: { select: { name: true, kind: true } } },
  });
  if (!task) redirect("/projects");
  const access = await getProjectAccess(task.projectId, user);
  if (!access || !(access.isAdmin || access.role === "OWNER")) {
    redirect(`/projects/${task.projectId}`);
  }
  if (task.status.kind !== "DELETED") redirect(`/projects/${task.projectId}/tasks/${id}`);

  const target = await prisma.workflowStatus.findFirst({
    where: { projectId: task.projectId, kind: "NORMAL" },
    orderBy: { position: "asc" },
    select: { id: true, name: true },
  });
  if (!target) redirect(`/projects/${task.projectId}`);

  const position = await prisma.task.count({
    where: { projectId: task.projectId, statusId: target.id },
  });
  await prisma.task.update({
    where: { id },
    data: {
      statusId: target.id,
      position,
      activities: {
        create: {
          userId: user.id,
          type: "RESTORED",
          field: "status",
          oldValue: task.status.name,
          newValue: target.name,
        },
      },
    },
  });
  revalidatePath(`/projects/${task.projectId}`);
  redirect(`/projects/${task.projectId}?toast=restored`);
}

/** Self-assign a task ("take it over"). Any EDITOR+ on the project can do this —
 *  it's how a member picks up an unassigned task (or one they need to own) so they
 *  can then change its status (canModifyTask requires owner/assignee). */
export async function assignToMe(formData: FormData) {
  const user = await requireUser();
  const id = str(formData.get("id"));
  if (!id) return;

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      projectId: true,
      assigneeId: true,
      status: { select: { kind: true } },
      assignee: { select: { name: true, email: true } },
    },
  });
  if (!task) redirect("/projects");

  const back = `/projects/${task.projectId}/tasks/${id}`;
  const access = await getProjectAccess(task.projectId, user);
  if (!access || !atLeast(access.role, "EDITOR")) redirect(back);
  if (task.status.kind === "DELETED") redirect(back); // can't pick up a deleted task
  if (task.assigneeId === user.id) redirect(back); // already mine

  await prisma.task.update({
    where: { id },
    data: {
      assigneeId: user.id,
      activities: {
        create: {
          userId: user.id,
          type: "UPDATED",
          field: "assignee",
          oldValue: task.assignee?.name ?? task.assignee?.email ?? "Unassigned",
          newValue: user.name ?? user.email ?? "Me",
        },
      },
    },
  });
  revalidatePath(back);
  redirect(`${back}?toast=assigned`);
}
