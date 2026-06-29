"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { signIn, signOut } from "@/auth";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function googleSignIn() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function doSignOut() {
  await signOut({ redirectTo: "/signin" });
}

export async function setTheme(formData: FormData) {
  const user = await requireUser();
  const theme = formData.get("theme") as string;
  if (theme !== "light" && theme !== "dark") return { error: "Invalid theme" };

  await prisma.user.update({ where: { id: user.id }, data: { theme } });
  (await cookies()).set("theme", theme, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60, // 1 year
  });
  revalidatePath("/", "layout");
}
