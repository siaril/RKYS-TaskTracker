import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    // allowDangerousEmailAccountLinking lets pre-created users (seeded by email,
    // no linked account yet) connect their Google account on first sign-in.
    Google({ allowDangerousEmailAccountLinking: true }),
  ],
  session: { strategy: "database" },
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    // Allowlist: only people already in the database (seeded team) and not
    // deactivated may sign in.
    async signIn({ user, profile }) {
      const email = (user.email ?? profile?.email ?? "").toLowerCase();
      if (!email) return false;
      const allowed = await prisma.user.findUnique({
        where: { email },
        select: { id: true, disabled: true },
      });
      return Boolean(allowed && !allowed.disabled);
    },
    // Surface the user id + role + theme on the session for use across the app.
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as { role?: "ADMIN" | "MEMBER" }).role ?? "MEMBER";
        session.user.theme = ((user as { theme?: string | null }).theme ?? "light") as "light" | "dark";
      }
      return session;
    },
  },
});
