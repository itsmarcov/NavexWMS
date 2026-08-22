import { PrismaClient, RoleUtilisateur, StatutExpediteur } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const MOT_DE_PASSE_TEST = "Test@1234";

async function main() {
  const hash = await bcrypt.hash(MOT_DE_PASSE_TEST, 12);

  const expediteur = await prisma.expediteur.upsert({
    where: { email: "contact@sarl-boumerdes.dz" },
    update: {},
    create: {
      nom_entreprise: "SARL Transport Boumerdès",
      email: "contact@sarl-boumerdes.dz",
      telephone: "+213661234567",
      adresse: "Zone industrielle, Boumerdès, Algérie",
      statut: StatutExpediteur.actif,
      langue_preferee: "fr",
    },
  });

  const utilisateurs: Array<{ email: string; role: RoleUtilisateur; expediteur_id?: string }> = [
    { email: "admin@navex.dz", role: RoleUtilisateur.admin },
    { email: "commercial@navex.dz", role: RoleUtilisateur.agent_commercial },
    { email: "entrepot@navex.dz", role: RoleUtilisateur.agent_entrepot },
    { email: "expediteur@navex.dz", role: RoleUtilisateur.expediteur, expediteur_id: expediteur.id },
  ];

  for (const u of utilisateurs) {
    await prisma.utilisateur.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password_hash: hash },
    });
  }

  const entrepotExistant = await prisma.entrepot.findFirst({ where: { nom: "Entrepôt Navex Alger" } });
  if (!entrepotExistant) {
    const entrepot = await prisma.entrepot.create({
      data: {
        nom: "Entrepôt Navex Alger",
        adresse: "Zone portuaire, Alger, Algérie",
      },
    });

    const emplacements = [];
    for (const zone of ["A", "B"]) {
      for (const allee of ["1", "2"]) {
        for (const rack of ["A", "B", "C"]) {
          for (const niveau of ["0", "1", "2"]) {
            emplacements.push({
              entrepot_id: entrepot.id,
              zone,
              allee,
              rack,
              niveau,
              capacite_max: 500,
            });
          }
        }
      }
    }
    await prisma.emplacement.createMany({ data: emplacements });
  }

  console.log("Seed terminé. Comptes de test (mot de passe : %s) :", MOT_DE_PASSE_TEST);
  for (const u of utilisateurs) console.log(`  - ${u.email} (${u.role})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
