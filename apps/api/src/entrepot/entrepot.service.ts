import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { TypeEvenement } from "@prisma/client";
import * as jwt from "jsonwebtoken";
import { AuditService } from "../audit/audit.service";
import { env } from "../env";
import { PrismaService } from "../prisma/prisma.service";
import { PositionnementDto, ReceptionDto, ScanQrDto } from "./dto/entrepot.dto";

interface ContexteUtilisateur {
  sub: string;
  role: string;
}

@Injectable()
export class EntrepotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Scan du QR d'une décharge : vérifie la signature RS256, l'expiration et
   * le nonce lié à la décharge, puis enregistre l'arrivée au quai.
   */
  async scanner(dto: ScanQrDto, user: ContexteUtilisateur, ip?: string) {
    let charge: { decharge_id: string; nonce: string };
    try {
      charge = jwt.verify(dto.qr_token, env.publicKey(), { algorithms: ["RS256"] }) as never;
    } catch (erreur) {
      const expire = erreur instanceof jwt.TokenExpiredError;
      throw new UnauthorizedException({ code: expire ? "erreurs.qr_expire" : "erreurs.qr_invalide" });
    }

    const decharge = await this.prisma.decharge.findUnique({
      where: { id: charge?.decharge_id },
      include: {
        demande: {
          select: {
            reference: true,
            expediteur: { select: { nom_entreprise: true } },
            _count: { select: { produits: { where: { statut_validation: "approuve" } } } },
          },
        },
      },
    });

    // Nonce différent → QR obsolète (régénéré) ou falsifié.
    if (!decharge || decharge.nonce !== charge?.nonce) {
      throw new UnauthorizedException({ code: "erreurs.qr_invalide" });
    }
    if (decharge.statut === "scannee") {
      // decharge_id inclus pour que l'interface puisse proposer le lien
      // « traiter cette décharge » directement après un double scan douchette.
      throw new ConflictException({
        code: "erreurs.decharge_deja_scannee",
        decharge_id: decharge.id,
      });
    }

    await this.prisma.$transaction([
      this.prisma.decharge.update({ where: { id: decharge.id }, data: { statut: "scannee" } }),
      this.prisma.mouvementEntrepot.create({
        data: {
          decharge_id: decharge.id,
          agent_entrepot_id: user.sub,
          type_evenement: "arrivee_scannee",
        },
      }),
    ]);

    await this.audit.log({
      entite_type: "Decharge",
      entite_id: decharge.id,
      action: "SCAN_ARRIVEE",
      utilisateur_id: user.sub,
      donnees_apres: { numero: decharge.numero_decharge, demande: decharge.demande.reference },
      ip_adresse: ip,
    });

    return {
      decharge_id: decharge.id,
      numero_decharge: decharge.numero_decharge,
      demande_reference: decharge.demande.reference,
      expediteur_nom: decharge.demande.expediteur.nom_entreprise,
      nb_produits: decharge.demande._count.produits,
    };
  }

  /** Décharges scannées en attente de réception ou de positionnement. */
  async listerDecharges() {
    const decharges = await this.prisma.decharge.findMany({
      where: { statut: "scannee" },
      orderBy: { date_generation: "desc" },
      take: 100,
      include: {
        demande: {
          select: {
            reference: true,
            expediteur: { select: { nom_entreprise: true } },
            _count: { select: { produits: { where: { statut_validation: "approuve" } } } },
          },
        },
        mouvements: { select: { type_evenement: true } },
      },
    });

    return decharges.map((d) => ({
      id: d.id,
      numero_decharge: d.numero_decharge,
      statut: d.statut,
      date_generation: d.date_generation,
      demande: { reference: d.demande.reference },
      expediteur_nom: d.demande.expediteur.nom_entreprise,
      nb_produits: d.demande._count.produits,
      evenements: [...new Set(d.mouvements.map((m) => m.type_evenement))],
    }));
  }

  /** Détail complet d'une décharge pour l'agent : produits, timeline, emplacement. */
  async detailDecharge(id: string) {
    const decharge = await this.prisma.decharge.findUnique({
      where: { id },
      include: {
        demande: {
          select: {
            reference: true,
            expediteur: { select: { nom_entreprise: true } },
            produits: {
              where: { statut_validation: "approuve" },
              orderBy: { sku_code: "asc" },
              select: {
                id: true,
                sku_code: true,
                designation: true,
                quantite: true,
                longueur_cm: true,
                largeur_cm: true,
                hauteur_cm: true,
                poids_kg: true,
                fragile: true,
                type_emballage: true,
              },
            },
          },
        },
        mouvements: {
          orderBy: { date_evenement: "asc" },
          include: {
            agent_entrepot: { select: { email: true } },
            emplacement: { select: { zone: true, allee: true, rack: true, niveau: true } },
          },
        },
      },
    });

    if (!decharge) throw new NotFoundException({ code: "erreurs.introuvable" });

    return {
      id: decharge.id,
      numero_decharge: decharge.numero_decharge,
      statut: decharge.statut,
      date_generation: decharge.date_generation,
      demande: { reference: decharge.demande.reference },
      expediteur_nom: decharge.demande.expediteur.nom_entreprise,
      nb_produits: decharge.demande.produits.length,
      produits: decharge.demande.produits,
      mouvements: decharge.mouvements.map((m) => ({
        id: m.id,
        type_evenement: m.type_evenement,
        date_evenement: m.date_evenement,
        notes: m.notes,
        agent_email: m.agent_entrepot.email,
        emplacement: m.emplacement
          ? {
              zone: m.emplacement.zone,
              allee: m.emplacement.allee,
              rack: m.emplacement.rack,
              niveau: m.emplacement.niveau,
            }
          : null,
      })),
    };
  }

  /** Confirmation que la marchandise a été physiquement reçue. */
  async confirmerReception(dechargeId: string, dto: ReceptionDto, user: ContexteUtilisateur, ip?: string) {
    const decharge = await this.prisma.decharge.findUnique({
      where: { id: dechargeId },
      include: { mouvements: { where: { type_evenement: "reception_confirmee" }, select: { id: true } } },
    });

    if (!decharge) throw new NotFoundException({ code: "erreurs.introuvable" });
    if (decharge.statut !== "scannee") {
      throw new ConflictException({ code: "erreurs.decharge_non_scannee" });
    }
    if (decharge.mouvements.length > 0) {
      throw new ConflictException({ code: "erreurs.deja_recue" });
    }

    await this.prisma.mouvementEntrepot.create({
      data: {
        decharge_id: dechargeId,
        agent_entrepot_id: user.sub,
        type_evenement: TypeEvenement.reception_confirmee,
        notes: dto.notes?.trim() || null,
      },
    });

    await this.audit.log({
      entite_type: "Decharge",
      entite_id: dechargeId,
      action: "RECEPTION_CONFIRMEE",
      utilisateur_id: user.sub,
      donnees_apres: { numero: decharge.numero_decharge },
      ip_adresse: ip,
    });

    return { ok: true };
  }

  /** Emplacements libres (ou tous), triés par zone/allée/rack/niveau. */
  async listerEmplacements(libresSeulement: boolean) {
    return this.prisma.emplacement.findMany({
      where: libresSeulement ? { occupee: false } : {},
      orderBy: [{ zone: "asc" }, { allee: "asc" }, { rack: "asc" }, { niveau: "asc" }],
    });
  }

  /**
   * Affecte un emplacement libre à une décharge dont la réception est confirmée :
   * occupe l'emplacement et journalise le mouvement de positionnement.
   */
  async positionner(dechargeId: string, dto: PositionnementDto, user: ContexteUtilisateur, ip?: string) {
    const decharge = await this.prisma.decharge.findUnique({
      where: { id: dechargeId },
      include: {
        mouvements: {
          where: { type_evenement: "reception_confirmee" },
          select: { id: true },
        },
      },
    });

    if (!decharge) throw new NotFoundException({ code: "erreurs.introuvable" });
    if (decharge.mouvements.length === 0) {
      throw new ConflictException({ code: "erreurs.reception_requise" });
    }

    const dejaPositionnee = await this.prisma.mouvementEntrepot.count({
      where: { decharge_id: dechargeId, type_evenement: "repositionnement", emplacement_id: { not: null } },
    });
    if (dejaPositionnee > 0) {
      throw new ConflictException({ code: "erreurs.deja_positionnee" });
    }

    const emplacement = await this.prisma.emplacement.findUnique({ where: { id: dto.emplacement_id } });
    if (!emplacement) throw new NotFoundException({ code: "erreurs.introuvable" });
    if (emplacement.occupee) throw new ConflictException({ code: "erreurs.emplacement_occupe" });

    await this.prisma.$transaction([
      this.prisma.emplacement.update({ where: { id: emplacement.id }, data: { occupee: true } }),
      this.prisma.mouvementEntrepot.create({
        data: {
          decharge_id: dechargeId,
          agent_entrepot_id: user.sub,
          type_evenement: TypeEvenement.repositionnement,
          emplacement_id: emplacement.id,
          notes: dto.notes?.trim() || null,
        },
      }),
    ]);

    await this.audit.log({
      entite_type: "Decharge",
      entite_id: dechargeId,
      action: "POSITIONNEMENT",
      utilisateur_id: user.sub,
      donnees_apres: {
        numero: decharge.numero_decharge,
        emplacement: `${emplacement.zone}-${emplacement.allee}-${emplacement.rack}-${emplacement.niveau}`,
      },
      ip_adresse: ip,
    });

    return { ok: true };
  }
}
