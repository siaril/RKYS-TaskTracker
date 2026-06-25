import { prisma } from "@/lib/prisma";

export type ProjectRole = "OWNER" | "EDITOR" | "VIEWER";

const RANK: Record<ProjectRole, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };

export type SessionUser = { id: string; role?: "ADMIN" | "MEMBER" | null };

export type ProjectAccess = { role: ProjectRole; isAdmin: boolean };

export function isAdmin(user: SessionUser): boolean {
  return user.role === "ADMIN";
}

/** A user's effective access to a project, or null if they have none.
 *  Global admins always get OWNER-level access. */
export async function getProjectAccess(
  projectId: string,
  user: SessionUser,
): Promise<ProjectAccess | null> {
  if (isAdmin(user)) return { role: "OWNER", isAdmin: true };
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { role: true },
  });
  return membership ? { role: membership.role as ProjectRole, isAdmin: false } : null;
}

/** Role rank check, e.g. atLeast(role, "EDITOR"). */
export function atLeast(role: ProjectRole, min: ProjectRole): boolean {
  return RANK[role] >= RANK[min];
}

/** Whether a user may modify (edit/delete/move) a specific task.
 *  Admins and project OWNERs can touch any task in the project; EDITORs are
 *  limited to tasks they own (created) or are assigned to; VIEWERs cannot. */
export function canModifyTask(
  access: ProjectAccess,
  task: { ownerId: string; assigneeId: string | null },
  userId: string,
): boolean {
  if (access.isAdmin || access.role === "OWNER") return true;
  if (access.role === "EDITOR") {
    return task.ownerId === userId || task.assigneeId === userId;
  }
  return false;
}

/** Whether a user may delete (move to the Deleted column) a specific task.
 *  Admins and project OWNERs can delete any task; EDITORs only tasks they
 *  created (own); VIEWERs cannot. Stricter than canModifyTask (no assignee). */
export function canDeleteTask(
  access: ProjectAccess,
  task: { ownerId: string },
  userId: string,
): boolean {
  if (access.isAdmin || access.role === "OWNER") return true;
  if (access.role === "EDITOR") return task.ownerId === userId;
  return false;
}

/** Prisma `where` clause limiting projects to those a user may see. */
export function visibleProjectsWhere(user: SessionUser) {
  return isAdmin(user) ? {} : { members: { some: { userId: user.id } } };
}
