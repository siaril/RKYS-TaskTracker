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

const DEFAULT_COLOR = "#0073ea";

export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!isAdmin(user)) return { error: "Only admins can manage products." };
  const name = str(formData.get("name"));
  const description = str(formData.get("description"));
  const color = str(formData.get("color")) || DEFAULT_COLOR;
  if (!name) return { error: "Name is required." };
  try {
    await prisma.product.create({
      data: { name, description: description || null, color },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `A product named "${name}" already exists.` };
    throw e;
  }
  revalidatePath("/products");
  return { ok: true };
}

export async function updateProduct(formData: FormData) {
  await requireAdmin();
  const id = str(formData.get("id"));
  const name = str(formData.get("name"));
  const description = str(formData.get("description"));
  const color = str(formData.get("color")) || DEFAULT_COLOR;
  if (!id || !name) redirect("/products");
  try {
    await prisma.product.update({
      where: { id },
      data: { name, description: description || null, color },
    });
  } catch (e) {
    if (isUniqueViolation(e)) redirect(`/products?edit=${id}&error=name-taken`);
    throw e;
  }
  revalidatePath("/products");
  redirect("/products?toast=saved");
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();
  const id = str(formData.get("id"));
  if (!id) return;
  try {
    await prisma.product.delete({ where: { id } });
  } catch (e) {
    if (hasCode(e, "P2003")) redirect("/products?error=in-use");
    throw e;
  }
  revalidatePath("/products");
}
