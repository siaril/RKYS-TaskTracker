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

function hasCode(e: unknown, code: string): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === code;
}

function isUniqueViolation(e: unknown): boolean {
  return hasCode(e, "P2002");
}

export async function createClient(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!isAdmin(user)) return { error: "Only admins can manage clients." };
  const name = str(formData.get("name"));
  const notes = str(formData.get("notes"));
  if (!name) return { error: "Name is required." };
  try {
    await prisma.client.create({ data: { name, notes: notes || null } });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `A client named "${name}" already exists.` };
    throw e;
  }
  revalidatePath("/clients");
  return { ok: true };
}

export async function updateClient(formData: FormData) {
  await requireAdmin();
  const id = str(formData.get("id"));
  const name = str(formData.get("name"));
  const notes = str(formData.get("notes"));
  if (!id || !name) redirect("/clients");
  try {
    await prisma.client.update({ where: { id }, data: { name, notes: notes || null } });
  } catch (e) {
    if (isUniqueViolation(e)) redirect(`/clients?edit=${id}&error=name-taken`);
    throw e;
  }
  revalidatePath("/clients");
  redirect("/clients?toast=saved");
}

export async function deleteClient(formData: FormData) {
  await requireAdmin();
  const id = str(formData.get("id"));
  if (!id) return;
  try {
    await prisma.client.delete({ where: { id } });
  } catch (e) {
    if (hasCode(e, "P2003")) redirect("/clients?error=in-use");
    throw e;
  }
  revalidatePath("/clients");
}
