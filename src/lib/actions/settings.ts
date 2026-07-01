"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { normalizePhone } from "@/lib/whatsapp";

/** Toggle the signed-in user's email notifications on/off. */
export async function setEmailNotifications(enabled: boolean): Promise<void> {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { emailNotifications: enabled },
  });
  revalidatePath("/settings");
}

/** Save the signed-in user's WhatsApp phone (normalized to digits). Empty clears it and,
 *  since a phone is required, also turns WhatsApp notifications off. Returns the stored value. */
export async function setPhone(phoneRaw: string): Promise<{ phone: string }> {
  const user = await requireUser();
  const phone = normalizePhone(phoneRaw);
  await prisma.user.update({
    where: { id: user.id },
    data: phone ? { phone } : { phone: null, whatsappNotifications: false },
  });
  revalidatePath("/settings");
  return { phone };
}

/** Toggle WhatsApp notifications. Can only be enabled once a phone is saved. */
export async function setWhatsAppNotifications(enabled: boolean): Promise<void> {
  const user = await requireUser();
  if (enabled) {
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: { phone: true },
    });
    if (!u?.phone) return; // no phone → can't enable
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { whatsappNotifications: enabled },
  });
  revalidatePath("/settings");
}
