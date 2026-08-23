import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RoleUtilisateur, StatutDemande } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreeDemandeDto } from "./dto/demande.dto";

const ANNEE = () => new Date().getFullYear();

@Injectable()
export class DemandesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** DEM-2026-00001 — séquence par année, avec reprise en cas de collision. */
  private async genererReference(tx: Prisma.TransactionClient): Promise<string> {
    const annee = ANNEE();
    for (let tentative = 0; tentative < 5; tentative++) {
      const nb = await tx.demandeStockage.count({
        where: { date_creation: { gte: new Date(`${annee}-01-01`), lt: new Date(`${annee + 1}-01-01`) } },
      });
      const reference = `DEM-${annee}-${String(nb + 1).padStart(5, "0")}`;
      const existe = await tx.demandeStockage.findUnique({ where: { reference }, select: { id: true } });
      if (!existe) return reference;
    }
    // Filet de sécurité : unicité garantie par horodatage
    return `DEM-${annee}-${Date.now()}`;
  }

  async creer(expediteurId: string, utilisateurId: string, dto: CreeDemandeDto, ip?: string) {
    const demande = await this.prisma.$transaction(async (tx) => {
      const reference = await this.genererReference(tx);
      return tx.demandeStockage.create({
        data: {
          reference,
          expediteur_id: expediteurId,
          statut: StatutDemande.en_attente,
          produits: {
            create: dto.produits.map((p) => ({
              sku_code: p.sku_code,
              designation: p.designation,
              longueur_cm: p.longueur_cm,
              largeur_cm: p.largeur_cm,
              hauteur_cm: p.hauteur_cm,
              poids_kg: p.poids_kg,
              fragile: p.fragile,
              type_emballage: p.type_emballage,
              quantite: p.quantite,
              photo_url: p.photo_url ?? null,
            })),
          },
        },
        include: { produits: true, expediteur: { select: { id: true, nom_entreprise: true } } },
      });
    });

    await this.audit.log({
      entite_type: "DemandeStockage",
      entite_id: demande.id,
      action: "CREATE",
      utilisateur_id: utilisateurId,
      donnees_apres: {
        reference: demande.reference,
        statut: demande.statut,
        nb_produits: demande.produits.length,
      },
      ip_adresse: ip,
    });

    return demande;
  }

  /**
   * Liste des demandes : l'expéditeur ne voit que les siennes,
   * agent commercial et admin voient tout.
   */
  async lister(role: RoleUtilisateur, expediteurId?: string | null) {
    const where: Prisma.DemandeStockageWhereInput =
      role === "expediteur" ? { expediteur_id: expediteurId ?? "__aucun__" } : {};

    return this.prisma.demandeStockage.findMany({
      where,
      orderBy: { date_creation: "desc" },
      include: {
        expediteur: { select: { id: true, nom_entreprise: true } },
        _count: { select: { produits: true } },
        decharge: { select: { id: true, numero_decharge: true, statut: true } },
      },
    });
  }

  async detail(id: string, role: RoleUtilisateur, expediteurId?: string | null) {
    const demande = await this.prisma.demandeStockage.findUnique({
      where: { id },
      include: {
        produits: { orderBy: { id: "asc" } },
        expediteur: { select: { id: true, nom_entreprise: true, email: true, telephone: true, adresse: true } },
        decharge: true,
        agent_commercial: { select: { email: true } },
      },
    });

    if (!demande) throw new NotFoundException({ code: "erreurs.introuvable" });
    if (role === "expediteur" && demande.expediteur_id !== expediteurId) {
      throw new NotFoundException({ code: "erreurs.introuvable" });
    }
    return demande;
  }
}
