// Usage: npm run make-admin -- someone@example.com
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = process.argv[2]?.toLowerCase();
  if (!email) throw new Error("Usage: npm run make-admin -- email@example.com");
  const user = await db.user.update({ where: { email }, data: { role: "ADMIN" } });
  console.log(`${user.email} is now an admin.`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
