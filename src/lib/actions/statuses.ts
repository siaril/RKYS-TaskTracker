"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess, atLeast, type SessionUser } from "@/lib/access";

function str(v: FormDataEntryValue | null): string {
  return (typeof v === "string" ? v : "").trim();
}
function hasCode(e: unknown, code: string): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === code;
}
async function canManage(projectId: string, user: SessionUser): Promise<boolean> {
  const access = await getProjectAccess(projectId, user);
  return !!access && atLeast(access.role, "OWNER");
}

const DEFAULT_COLOR = "#c4c4c4";
const settings = (projectId: string, q = "") => `/projects/${projectId}/settings${q}`;

export async function createStatus(formData: FormData) {
  const user = await requireUser();
  const projectId = str(formData.get("projectId"));
  const name = str(formData.get("name"));
  const color = str(formData.get("color")) || DEFAULT_COLOR;
  if (!projectId || !(await canManage(projectId, user))) redirect(settings(projectId));
  if (!name) redirect(settings(projectId, "?error=status-name"));

  const position = await prisma.workflowStatus.count({ where: { projectId } });
  await prisma.workflowStatus.create({ data: { projectId, name, color, position } });
  revalidatePath(settings(projectId));
  redirect(settings(projectId, "?toast=saved"));
}

export async function updateStatus(formData: FormData) {
  const user = await requireUser();
  const id = str(formData.get("id"));
  const name = str(formData.get("name"));
  const color = str(formData.get("color")) || DEFAULT_COLOR;
  const status = await prisma.workflowStatus.findUnique({
    where: { id },
    select: { projectId: true, kind: true },
  });
  if (!status) redirect("/projects");
  if (!(await canManage(status.projectId, user))) redirect(settings(status.projectId));
  if (status.kind === "DELETED") redirect(settings(status.projectId, "?error=locked-status"));
  if (!name) redirect(settings(status.projectId, "?error=status-name"));

  await prisma.workflowStatus.update({ where: { id }, data: { name, color } });
  revalidatePath(settings(status.projectId));
  redirect(settings(status.projectId, "?toast=saved"));
}

export async function deleteStatus(formData: FormData) {
  const user = await requireUser();
  const id = str(formData.get("id"));
  const status = await prisma.workflowStatus.findUnique({
    where: { id },
    select: { projectId: true, kind: true },
  });
  if (!status) redirect("/projects");
  if (!(await canManage(status.projectId, user))) redirect(settings(status.projectId));
  if (status.kind === "DELETED") redirect(settings(status.projectId, "?error=locked-status"));

  const count = await prisma.workflowStatus.count({ where: { projectId: status.projectId } });
  if (count <= 1) redirect(settings(status.projectId, "?error=last-status"));

  try {
    await prisma.workflowStatus.delete({ where: { id } });
  } catch (e) {
    // Task.status is Restrict — a status with tasks can't be deleted.
    if (hasCode(e, "P2003")) redirect(settings(status.projectId, "?error=status-in-use"));
    throw e;
  }
  revalidatePath(settings(status.projectId));
  redirect(settings(status.projectId, "?toast=saved"));
}

export async function moveStatus(formData: FormData) {
  const user = await requireUser();
  const id = str(formData.get("id"));
  const direction = str(formData.get("direction")); // "up" | "down"
  const status = await prisma.workflowStatus.findUnique({
    where: { id },
    select: { projectId: true, kind: true },
  });
  if (!status) redirect("/projects");
  if (!(await canManage(status.projectId, user))) redirect(settings(status.projectId));
  if (status.kind === "DELETED") redirect(settings(status.projectId, "?error=locked-status"));

  const list = await prisma.workflowStatus.findMany({
    where: { projectId: status.projectId },
    orderBy: { position: "asc" },
  });
  const idx = list.findIndex((s) => s.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) {
    redirect(settings(status.projectId)); // already at the edge
  }

  const a = list[idx];
  const b = list[swapIdx];
  // Don't let a normal status be reordered past the Deleted column (stays last).
  if (b.kind === "DELETED") redirect(settings(status.projectId));
  await prisma.$transaction([
    prisma.workflowStatus.update({ where: { id: a.id }, data: { position: b.position } }),
    prisma.workflowStatus.update({ where: { id: b.id }, data: { position: a.position } }),
  ]);
  revalidatePath(settings(status.projectId));
  redirect(settings(status.projectId, "?toast=saved"));
}
