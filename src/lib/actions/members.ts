"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess, atLeast, type ProjectRole, type SessionUser } from "@/lib/access";

function str(v: FormDataEntryValue | null): string {
  return (typeof v === "string" ? v : "").trim();
}

const ROLES: ProjectRole[] = ["OWNER", "EDITOR", "VIEWER"];
function roleOf(v: string): ProjectRole {
  return (ROLES as string[]).includes(v) ? (v as ProjectRole) : "VIEWER";
}

async function canManage(projectId: string, user: SessionUser): Promise<boolean> {
  const access = await getProjectAccess(projectId, user);
  return !!access && atLeast(access.role, "OWNER");
}

export async function addMember(formData: FormData) {
  const user = await requireUser();
  const projectId = str(formData.get("projectId"));
  const userId = str(formData.get("userId"));
  const role = roleOf(str(formData.get("role")));
  if (!projectId || !userId) redirect(`/projects/${projectId}`);
  if (!(await canManage(projectId, user))) redirect(`/projects/${projectId}`);

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: { role },
    create: { projectId, userId, role },
  });
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?toast=saved`);
}

export async function updateMemberRole(formData: FormData) {
  const user = await requireUser();
  const projectId = str(formData.get("projectId"));
  const userId = str(formData.get("userId"));
  const role = roleOf(str(formData.get("role")));
  if (!projectId || !userId) redirect(`/projects/${projectId}`);
  if (!(await canManage(projectId, user))) redirect(`/projects/${projectId}`);

  // Don't allow demoting the last remaining owner.
  if (role !== "OWNER" && (await isLastOwner(projectId, userId))) {
    redirect(`/projects/${projectId}?error=last-owner`);
  }

  await prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { role },
  });
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?toast=saved`);
}

export async function removeMember(formData: FormData) {
  const user = await requireUser();
  const projectId = str(formData.get("projectId"));
  const userId = str(formData.get("userId"));
  if (!projectId || !userId) redirect(`/projects/${projectId}`);
  if (!(await canManage(projectId, user))) redirect(`/projects/${projectId}`);

  if (await isLastOwner(projectId, userId)) {
    redirect(`/projects/${projectId}?error=last-owner`);
  }

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId } },
  });
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?toast=saved`);
}

async function isLastOwner(projectId: string, userId: string): Promise<boolean> {
  const target = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });
  if (target?.role !== "OWNER") return false;
  const owners = await prisma.projectMember.count({ where: { projectId, role: "OWNER" } });
  return owners <= 1;
}
