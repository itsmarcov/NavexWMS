/**
 * Outil d'inspection / approbation manuelle (dépannage avant la Phase 3).
 *
 *   node scripts/inspecter-demandes.mjs                 → liste les demandes et leurs produits
 *   node scripts/inspecter-demandes.mjs DEM-2026-00001  → approuve tous les produits de la demande
 *
 * Nécessite DATABASE_URL pointant vers la base cible.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const referenceCible = process.argv[2];

try {
  if (!referenceCible) {
    const demandes = await prisma.demandeStockage.findMany({
      orderBy: { date_creation: "desc" },
      take: 20,
      include: {
        expediteur: { select: { nom_entreprise: true } },
        produits: { select: { id: true, designation: true, statut_validation: true } },
        decharge: { select: { numero_decharge: true } },
      },
    });

    if (demandes.length === 0) {
      console.log("Aucune demande en base.");
    }
    for (const d of demandes) {
      console.log(
        `${d.reference} | ${d.expediteur.nom_entreprise} | ${d.produits.length} produit(s) | ` +
          d.produits.map((p) => p.statut_validation).join(",") +
          (d.decharge ? ` | ${d.decharge.numero_decharge}` : ""),
      );
    }
  } else {
    const commerciale = await prisma.utilisateur.findFirst({
      where: { role: "agent_commercial" },
    });
    if (!commerciale) throw new Error("Aucun agent commercial trouvé pour valider.");

    const resultat = await prisma.produit.updateMany({
      where: { demande: { reference: referenceCible } },
      data: {
        statut_validation: "approuve",
      },
    });
    await prisma.demandeStockage.update({
      where: { reference: referenceCible },
      data: { statut: "approuvee", agent_commercial_id: commerciale.id, date_validation: new Date() },
    });
    console.log(`${resultat.count} produit(s) approuvé(s) par ${commerciale.email}.`);
  }
} finally {
  await prisma.$disconnect();
}
