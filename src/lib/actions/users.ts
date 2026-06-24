"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/session";
import { isAdmin } from "@/lib/access";

export type FormState = { error?: string; ok?: boolean } | undefined;

function str(v: FormDataEntryValue | null): string {
  return (typeof v === "string" ? v : "").trim();
}

function roleOf(v: string): "ADMIN" | "MEMBER" {
  return v.toUpperCase() === "ADMIN" ? "ADMIN" : "MEMBER";
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

/** Add a user to the login allowlist. They can sign in with Google once added. */
export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!isAdmin(user)) return { error: "Only admins can manage users." };

  const name = str(formData.get("name"));
  const email = str(formData.get("email")).toLowerCase();
  const role = roleOf(str(formData.get("role")));
  if (!name) return { error: "Name is required." };
  if (!email || !email.includes("@")) return { error: "A valid email is required." };

  try {
    await prisma.user.create({ data: { name, email, role } });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `A user with email "${email}" already exists.` };
    throw e;
  }
  revalidatePath("/users");
  return { ok: true };
}

/** Edit a user's display name and role. */
export async function updateUser(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData.get("id"));
  const name = str(formData.get("name"));
  const role = roleOf(str(formData.get("role")));
  if (!id || !name) redirect("/users");

  // Guard: an admin can't demote their own account (avoid losing admin access).
  if (id === admin.id && role !== "ADMIN") {
    redirect("/users?error=self-demote");
  }

  await prisma.user.update({ where: { id }, data: { name, role } });
  revalidatePath("/users");
  redirect("/users?toast=saved");
}

/** Activate / deactivate a user. Deactivated users can't sign in and are logged
 *  out immediately; their tasks, comments, and history are kept intact. */
export async function setUserDisabled(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData.get("id"));
  const disabled = str(formData.get("disabled")) === "true";
  if (!id) redirect("/users");

  // Guard: an admin can't deactivate their own account.
  if (id === admin.id && disabled) {
    redirect("/users?error=self-disable");
  }

  await prisma.user.update({ where: { id }, data: { disabled } });
  // On deactivate, drop any active sessions so they're signed out right away.
  if (disabled) {
    await prisma.session.deleteMany({ where: { userId: id } });
  }
  revalidatePath("/users");
  redirect("/users?toast=saved");
}
