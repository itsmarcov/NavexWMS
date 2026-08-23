// Vérification du seed entrepôt/emplacements sur la base distante.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const principal = async () => {
  const entrepots = await prisma.entrepot.findMany({ include: { _count: { select: { emplacements: true } } } });
  console.log(
    "entrepôts:",
    entrepots.map((e) => `${e.nom} (${e._count.emplacements} emplacements)`),
  );
  const libres = await prisma.emplacement.count({ where: { occupee: false } });
  console.log("emplacements libres:", libres);
};

principal()
  .catch((e) => {
    console.error("ECHEC", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
