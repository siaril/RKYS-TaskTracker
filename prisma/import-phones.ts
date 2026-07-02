// Bulk-load WhatsApp phone numbers onto users, matched by user id, from a CSV.
//
//   npm run db:import-phones -- path/to/phones.csv
//
// CSV must have a header row with (at least) an `id` column and a `phone` column
// (a `name` column is ignored). Example — export the "user phone" sheet to CSV:
//   id,name,phone
//   cmqqoq4kd000a3xg1j7aevqza,Aril Haromi,6281318370501
//
// For each row with a phone, sets User.phone (digits only) and turns
// whatsappNotifications ON (they can opt out in Settings). Idempotent. Runs against
// whatever DATABASE_URL is set — point it at PROD to populate production.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizePhone } from "../src/lib/whatsapp";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  // Find the real header row — the first line that has both `id` and `phone` columns.
  // (Excel table exports can prepend a generic "Column1,Column2,…" row above it.)
  let header: string[] = [];
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().toLowerCase());
    if (cols.includes("id") && cols.includes("phone")) {
      header = cols;
      start = i + 1;
      break;
    }
  }
  if (start === -1) return [];
  return lines.slice(start).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

async function main() {
  const path = process.argv[2];
  const dry = process.argv.includes("--dry");
  if (!path) throw new Error("Usage: npm run db:import-phones -- path/to/phones.csv [--dry]");

  const rows = parseCsv(readFileSync(path, "utf8"));
  if (!rows.length) {
    throw new Error("CSV needs a header row containing `id` and `phone` columns.");
  }

  let updated = 0;
  let skippedNoPhone = 0;
  let notFound = 0;

  for (const row of rows) {
    const id = row.id;
    const phone = normalizePhone(row.phone ?? "");
    if (!id) continue;
    if (!phone) {
      skippedNoPhone++;
      continue;
    }
    if (dry) {
      // Preview only: check the user exists, don't write.
      const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
      if (exists) {
        updated++;
        console.log(`  would set ${id} → ${phone}`);
      } else {
        notFound++;
      }
      continue;
    }
    try {
      await prisma.user.update({
        where: { id },
        data: { phone, whatsappNotifications: true },
      });
      updated++;
    } catch {
      notFound++; // no user with that id in this database
    }
  }

  console.log(
    `${dry ? "[DRY RUN] " : ""}Done. ${dry ? "Would update" : "Updated"} ${updated} user(s)` +
      `${dry ? "" : " (phone + WhatsApp ON)"}. ` +
      `Skipped ${skippedNoPhone} without a phone; ${notFound} id(s) not found in this DB.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
