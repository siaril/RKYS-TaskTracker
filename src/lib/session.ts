import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";

/** Get the current session user, or redirect to sign-in if not logged in. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }
  return session.user;
}

/** Get the current user, or 404 if they aren't a global admin. Used to gate
 *  admin-only pages and actions (clients, products, user management, project
 *  creation) — notFound() hides the route's existence from non-admins. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    notFound();
  }
  return user;
}
