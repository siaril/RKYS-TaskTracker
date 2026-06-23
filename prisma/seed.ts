// Seed real clients + products. Idempotent (upsert by unique name) so it's
// safe to re-run. Invoked via `npm run db:seed` or `prisma db seed`.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { TEAM_USERS } from "./team-users";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const clients = [
  "Geodipa",
  "PLN NP",
  "PLN ICON+",
  "The Meru Sanur",
  "Bali Beach Hotel",
  "PT SMI",
];

const products = [
  { name: "Erica", description: "An AI agent platform", color: "#6161ff" },
  {
    name: "JourneyON",
    description: "A chatbot for hotel reservation",
    color: "#00c875",
  },
];

async function main() {
  for (const name of clients) {
    await prisma.client.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const p of products) {
    await prisma.product.upsert({
      where: { name: p.name },
      update: { description: p.description, color: p.color },
      create: p,
    });
  }
  for (const u of TEAM_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { name: u.name, email: u.email, role: u.role },
    });
  }

  const [clientCount, productCount, userCount] = await Promise.all([
    prisma.client.count(),
    prisma.product.count(),
    prisma.user.count(),
  ]);
  console.log(
    `Seed complete: ${clientCount} clients, ${productCount} products, ${userCount} users.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
