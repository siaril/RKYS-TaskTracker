import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "MEMBER";
      theme: "light" | "dark";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "ADMIN" | "MEMBER";
    theme?: string | null;
  }
}
