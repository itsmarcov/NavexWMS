import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RoleUtilisateur, StatutDemande } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { CatalogueService } from "../catalogue/catalogue.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreeDemandeDto } from "./dto/demande.dto";

const ANNEE = () => new Date().getFullYear();

@Injectable()
export class DemandesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly catalogueService: CatalogueService,
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
    // Un expéditeur suspendu (ou pas encore validé) ne peut pas créer de demandes.
    const expediteur = await this.prisma.expediteur.findUnique({
      where: { id: expediteurId },
      select: { statut: true },
    });
    if (expediteur && expediteur.statut !== "actif") {
      throw new ForbiddenException({
        code:
          expediteur.statut === "suspendu"
            ? "erreurs.expediteur_suspendu"
            : "erreurs.expediteur_en_attente",
      });
    }

    const skusEntrants = dto.produits.map((p) => p.sku_code);
    const skusUniques = new Set(skusEntrants);
    if (skusUniques.size !== skusEntrants.length) {
      throw new ConflictException({ code: "erreurs.sku_doublon" });
    }

    const demande = await this.prisma.$transaction(async (tx) => {
      const reference = await this.genererReference(tx);
      return tx.demandeStockage.create({
        data: {
          reference,
          expediteur_id: expediteurId,
          statut: StatutDemande.en_attente,
          conditions_acceptee: dto.conditions_acceptee ?? false,
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
              volume_expedition_journalier: p.volume_expedition_journalier ?? null,
              volume_expedition_mensuel: p.volume_expedition_mensuel ?? null,
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

    const skus = dto.produits.map((p) => p.sku_code);
    if (skus.length > 0) {
      await this.catalogueService.incrementerUsage(skus, expediteurId).catch(() => undefined);
    }

    return demande;
  }

  /**
   * Liste des demandes : l'expéditeur ne voit que les siennes,
   * agent commercial et admin voient tout.
   * `attente` : uniquement les demandes ayant au moins un produit à traiter,
   * avec compteurs par statut de validation pour la file d'attente.
   */
  async lister(role: RoleUtilisateur, expediteurId?: string | null, attente = false) {
    const where: Prisma.DemandeStockageWhereInput =
      role === "expediteur" ? { expediteur_id: expediteurId ?? "__aucun__" } : {};

    if (attente) {
      where.produits = { some: { statut_validation: "en_attente" } };
    }

    return this.prisma.demandeStockage.findMany({
      where,
      orderBy: { date_creation: "desc" },
      include: {
        expediteur: { select: { id: true, nom_entreprise: true } },
        _count: { select: { produits: true } },
        decharge: { select: { id: true, numero_decharge: true, statut: true } },
        produits: {
          select: {
            longueur_cm: true,
            largeur_cm: true,
            hauteur_cm: true,
            quantite: true,
            volume_expedition_journalier: true,
            volume_expedition_mensuel: true,
            ...(attente ? { statut_validation: true } : {}),
          },
        },
      },
    });
  }

  /**
   * Décision de l'agent commercial sur un produit. Quand tous les produits
   * sont tranchés, le statut de la demande est dérivé : approuvée si tout
   * est approuvé, rejetée sinon. Chaque décision est journalisée.
   */
  async validerProduit(
    demandeId: string,
    produitId: string,
    utilisateurId: string,
    dto: { statut_validation: "approuve" | "refuse"; commentaire?: string },
    ip?: string,
  ) {
    const produit = await this.prisma.produit.findFirst({
      where: { id: produitId, demande_id: demandeId },
      include: { demande: { select: { id: true, reference: true, statut: true } } },
    });
    if (!produit) throw new NotFoundException({ code: "erreurs.introuvable" });

    const avant = { statut_validation: produit.statut_validation, commentaire: produit.commentaire };
    const decision = dto.statut_validation === "approuve" ? "approuve" : "refuse";

    const [produitMisAJour] = await this.prisma.$transaction([
      this.prisma.produit.update({
        where: { id: produitId },
        data: {
          statut_validation: decision,
          commentaire: dto.commentaire?.trim() || null,
          date_validation: new Date(),
        },
      }),
      // Recalcul du statut global quand tous les produits sont tranchés :
      // tous refusés → rejetée ; tous approuvés → approuvée ;
      // mixte (au moins un approuvé + au moins un refusé) → partiellement_approuvee.
      this.prisma.demandeStockage.updateMany({
        where: {
          id: demandeId,
          statut: "en_attente",
          produits: {
            none: { statut_validation: "en_attente" },
            some: { statut_validation: "refuse" },
            every: { statut_validation: "refuse" },
          },
        },
        data: {
          statut: "rejetee",
          date_traitement: new Date(),
          agent_commercial_id: utilisateurId,
        },
      }),
      this.prisma.demandeStockage.updateMany({
        where: {
          id: demandeId,
          statut: "en_attente",
          produits: {
            none: { statut_validation: "en_attente" },
            some: { statut_validation: "approuve" },
            every: { statut_validation: "approuve" },
          },
        },
        data: {
          statut: "approuvee",
          date_traitement: new Date(),
          agent_commercial_id: utilisateurId,
        },
      }),
      this.prisma.demandeStockage.updateMany({
        where: {
          id: demandeId,
          statut: "en_attente",
          produits: {
            none: { statut_validation: "en_attente" },
            some: { statut_validation: "approuve" },
            some: { statut_validation: "refuse" },
          },
        },
        data: {
          statut: "partiellement_approuvee",
          date_traitement: new Date(),
          agent_commercial_id: utilisateurId,
        },
      }),
    ]);

    const demandeFinale = await this.prisma.demandeStockage.findUnique({
      where: { id: demandeId },
      select: { reference: true, statut: true },
    });

    await this.audit.log({
      entite_type: "Produit",
      entite_id: produitId,
      action: `VALIDATION_${decision.toUpperCase()}`,
      utilisateur_id: utilisateurId,
      donnees_avant: avant,
      donnees_apres: { statut_validation: decision, commentaire: produitMisAJour.commentaire, demande_statut: demandeFinale?.statut },
      ip_adresse: ip,
    });

    return produitMisAJour;
  }

  /** Planification de la date de réception physique (agent commercial). */
  async planifierReception(
    demandeId: string,
    utilisateurId: string,
    dto: { date_reception_prevue: string },
    ip?: string,
  ) {
    const demande = await this.prisma.demandeStockage.findUnique({
      where: { id: demandeId },
      select: { id: true, reference: true, date_reception_prevue: true },
    });
    if (!demande) throw new NotFoundException({ code: "erreurs.introuvable" });

    const datePrevue = new Date(dto.date_reception_prevue);
    await this.prisma.demandeStockage.update({
      where: { id: demandeId },
      data: { date_reception_prevue: datePrevue },
    });

    await this.audit.log({
      entite_type: "DemandeStockage",
      entite_id: demandeId,
      action: "PLANIFICATION_RECEPTION",
      utilisateur_id: utilisateurId,
      donnees_avant: { date_reception_prevue: demande.date_reception_prevue },
      donnees_apres: { date_reception_prevue: datePrevue },
      ip_adresse: ip,
    });

    return { ok: true, date_reception_prevue: datePrevue };
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

  async historique(demandeId: string, role: RoleUtilisateur, expediteurId?: string | null) {
    const demande = await this.prisma.demandeStockage.findUnique({
      where: { id: demandeId },
      select: { id: true, expediteur_id: true },
    });
    if (!demande) throw new NotFoundException({ code: "erreurs.introuvable" });
    if (role === "expediteur" && demande.expediteur_id !== expediteurId) {
      throw new NotFoundException({ code: "erreurs.introuvable" });
    }

    const produitIds = await this.prisma.produit.findMany({
      where: { demande_id: demandeId },
      select: { id: true },
    }).then((ps) => ps.map((p) => p.id));

    const decharges = await this.prisma.decharge.findMany({
      where: { demande_id: demandeId },
      select: { id: true },
    });
    const dechargeIds = decharges.map((d) => d.id);

    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entite_type: "DemandeStockage", entite_id: demandeId },
          { entite_type: "Produit", entite_id: { in: produitIds } },
          { entite_type: "Decharge", entite_id: { in: dechargeIds } },
        ],
      },
      include: { utilisateur: { select: { email: true, prenom: true, nom: true } } },
      orderBy: { timestamp: "desc" },
    });

    const mouvements = await this.prisma.mouvementEntrepot.findMany({
      where: { decharge_id: { in: dechargeIds.length > 0 ? dechargeIds : ["__none__"] } },
      include: { agent_entrepot: { select: { email: true, prenom: true, nom: true } } },
      orderBy: { date_evenement: "desc" },
    });

    return [
      ...auditLogs.map((l) => ({
        id: l.id,
        action: l.action,
        date: l.timestamp.toISOString(),
        utilisateur: l.utilisateur,
        donnees_avant: l.donnees_avant,
        donnees_apres: l.donnees_apres,
      })),
      ...mouvements.map((m) => ({
        id: m.id,
        action: m.type_evenement,
        date: m.date_evenement.toISOString(),
        utilisateur: m.agent_entrepot,
        donnees_avant: null,
        donnees_apres: { notes: m.notes },
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}
