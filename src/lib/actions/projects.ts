"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess, atLeast } from "@/lib/access";
import { DEFAULT_STATUSES } from "@/lib/default-statuses";

export type FormState = { error?: string } | undefined;

function str(v: FormDataEntryValue | null): string {
  return (typeof v === "string" ? v : "").trim();
}

function productIds(formData: FormData): string[] {
  return formData
    .getAll("products")
    .map((v) => (typeof v === "string" ? v : ""))
    .filter(Boolean);
}

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = str(formData.get("name"));
  const description = str(formData.get("description"));
  const clientId = str(formData.get("clientId"));
  const products = productIds(formData);

  if (!name) return { error: "Project name is required." };
  if (!clientId) return { error: "Please choose a client." };

  await prisma.project.create({
    data: {
      name,
      description: description || null,
      clientId,
      createdById: user.id,
      products: { create: products.map((productId) => ({ productId })) },
      // Creator becomes the project owner.
      members: { create: { userId: user.id, role: "OWNER" } },
      // Seed the default workflow statuses.
      statuses: {
        create: DEFAULT_STATUSES.map((s, i) => ({
          name: s.name,
          color: s.color,
          position: i,
        })),
      },
    },
  });

  revalidatePath("/projects");
  redirect("/projects?toast=created");
}

export async function updateProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = str(formData.get("id"));
  const name = str(formData.get("name"));
  const description = str(formData.get("description"));
  const clientId = str(formData.get("clientId"));
  const products = productIds(formData);

  if (!id) return { error: "Missing project id." };
  if (!name) return { error: "Project name is required." };
  if (!clientId) return { error: "Please choose a client." };

  const access = await getProjectAccess(id, user);
  if (!access || !atLeast(access.role, "EDITOR")) {
    return { error: "You don't have permission to edit this project." };
  }

  await prisma.project.update({
    where: { id },
    data: {
      name,
      description: description || null,
      clientId,
      // Replace the product tags with the new selection.
      products: {
        deleteMany: {},
        create: products.map((productId) => ({ productId })),
      },
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  redirect("/projects?toast=saved");
}

export async function deleteProject(formData: FormData) {
  const user = await requireUser();
  const id = str(formData.get("id"));
  if (!id) return;

  const access = await getProjectAccess(id, user);
  if (!access || !atLeast(access.role, "OWNER")) {
    redirect(`/projects/${id}`);
  }

  await prisma.project.delete({ where: { id } });
  revalidatePath("/projects");
  redirect("/projects?toast=deleted");
}
