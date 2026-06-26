"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

/** Toggle the signed-in user's email notifications on/off. */
export async function setEmailNotifications(enabled: boolean): Promise<void> {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { emailNotifications: enabled },
  });
  revalidatePath("/settings");
}
