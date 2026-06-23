// The allowlisted team. Only these emails may sign in (enforced in src/auth.ts).
// Seeded by prisma/seed.ts so the allowlist survives a DB reset.
export type TeamUser = { name: string; email: string; role: "ADMIN" | "MEMBER" };

export const TEAM_USERS: TeamUser[] = [
  { name: "Rana Lubis", email: "rana.lubis@rekayasa.io", role: "ADMIN" },
  { name: "Dimas Isyanuar", email: "roflsmir@rekayasa.io", role: "ADMIN" },
  { name: "Aril Haromi", email: "aril.haromi@rekayasa.io", role: "ADMIN" },
  { name: "Arief Setiabudi", email: "arief.setiabudi2010@gmail.com", role: "MEMBER" },
  { name: "Maria Setiawan", email: "starfighter708@gmail.com", role: "MEMBER" },
  { name: "Fikar", email: "masdar.zulfikar@gmail.com", role: "MEMBER" },
  { name: "Akmal Dira", email: "akmaldiraa@gmail.com", role: "MEMBER" },
  { name: "Fardil", email: "fardil.khalidi@gmail.com", role: "MEMBER" },
];
