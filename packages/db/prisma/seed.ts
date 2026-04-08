import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const testUser = await prisma.user.upsert({
    where: { email: "dev@stagecraft.test" },
    update: {},
    create: {
      email: "dev@stagecraft.test",
      name: "Dev User",
    },
  });

  console.log(`Created test user: ${testUser.id}`);
  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
