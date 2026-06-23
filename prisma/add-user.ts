// Add (or update) a single allowlisted user — needed for someone to be able to
// sign in, since login is restricted to users that exist in the DB.
//
// Usage:
//   npm run db:add-user -- "<name>" "<email>" [ADMIN|MEMBER]
//   (role is optional, defaults to MEMBER)
//
// Runs against whatever DATABASE_URL points to. To add to PRODUCTION, run it in
// the Render Shell, or locally with the prod URL:
//   DATABASE_URL="<render external url>" npm run db:add-user -- "Ahmad" "sandi.hb@gmail.com"
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const [name, emailArg, roleArg] = process.argv.slice(2);
  if (!name || !emailArg) {
    console.error('Usage: npm run db:add-user -- "<name>" "<email>" [ADMIN|MEMBER]');
    process.exit(1);
  }
  const email = emailArg.trim().toLowerCase();
  const role = (roleArg ?? "").toUpperCase() === "ADMIN" ? "ADMIN" : "MEMBER";

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role },
    create: { name, email, role },
  });

  console.log(`✅ User ready: ${user.name} <${user.email}> (${user.role})`);
  console.log("They can now sign in with Google using that email.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
