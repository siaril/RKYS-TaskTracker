import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Get the current session user, or redirect to sign-in if not logged in. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }
  return session.user;
}
