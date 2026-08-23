import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
try {
  console.log("utilisateurs:", await p.utilisateur.count());
} catch (e) {
  console.error("ERR", e.message.slice(0, 300));
  process.exitCode = 1;
} finally {
  await p.$disconnect();
}
