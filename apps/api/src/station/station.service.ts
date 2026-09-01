import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import * as jwt from "jsonwebtoken";
import * as QRCode from "qrcode";
import { AuditService } from "../audit/audit.service";
import { env } from "../env";
import { PrismaService } from "../prisma/prisma.service";
import { GenererTransitDto, ModifierProduitStationDto, ScanStationDto } from "./dto/station.dto";

interface ContexteUtilisateur {
  sub: string;
  role: string;
  station_id?: string | null;
}

@Injectable()
export class StationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Scan du QR d'une décharge par l'agent station.
   * Vérifie la signature, l'expiration et le nonce.
   * Met la décharge en statut "transit" et crée un mouvement arrivee_station.
   */
  async scanner(dto: ScanStationDto, user: ContexteUtilisateur, ip?: string) {
    if (!user.station_id) {
      throw new ForbiddenException({ code: "erreurs.aucune_station_assignee" });
    }

    const token = dto.qr_token;
    let charge: { decharge_id: string; nonce: string };

    if (token.length <= 20) {
      const decharge = await this.prisma.decharge.findUnique({
        where: { qr_code: token },
        select: { qr_token: true },
      });
      if (!decharge) throw new UnauthorizedException({ code: "erreurs.qr_invalide" });
      try {
        charge = jwt.verify(decharge.qr_token, env.publicKey(), { algorithms: ["RS256"] }) as never;
      } catch (erreur) {
        const expire = erreur instanceof jwt.TokenExpiredError;
        throw new UnauthorizedException({ code: expire ? "erreurs.qr_expire" : "erreurs.qr_invalide" });
      }
    } else {
      try {
        charge = jwt.verify(token, env.publicKey(), { algorithms: ["RS256"] }) as never;
      } catch (erreur) {
        const expire = erreur instanceof jwt.TokenExpiredError;
        throw new UnauthorizedException({ code: expire ? "erreurs.qr_expire" : "erreurs.qr_invalide" });
      }
    }

    const decharge = await this.prisma.decharge.findUnique({
      where: { id: charge?.decharge_id },
      include: {
        demande: {
          select: {
            reference: true,
            expediteur: { select: { nom_entreprise: true } },
            _count: { select: { produits: { where: { statut_validation: "approuve" } } } },
            station_service_id: true,
          },
        },
      },
    });

    if (!decharge || decharge.nonce !== charge?.nonce) {
      throw new UnauthorizedException({ code: "erreurs.qr_invalide" });
    }

    if (decharge.statut === "transit") {
      throw new ConflictException({
        code: "erreurs.decharge_deja_en_transit",
        decharge_id: decharge.id,
      });
    }
    if (decharge.statut === "scannee") {
      throw new ConflictException({
        code: "erreurs.decharge_deja_scannee",
        decharge_id: decharge.id,
      });
    }

    await this.prisma.$transaction([
      this.prisma.decharge.update({ where: { id: decharge.id }, data: { statut: "transit" } }),
      this.prisma.mouvementEntrepot.create({
        data: {
          decharge_id: decharge.id,
          agent_entrepot_id: user.sub,
          type_evenement: "arrivee_station",
        },
      }),
    ]);

    await this.audit.log({
      entite_type: "Decharge",
      entite_id: decharge.id,
      action: "STATION_SCAN_ARRIVEE",
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

  /** Décharges en transit assignées à la station de l'agent. */
  async listerDecharges(user: ContexteUtilisateur) {
    if (!user.station_id) {
      throw new ForbiddenException({ code: "erreurs.aucune_station_assignee" });
    }

    const decharges = await this.prisma.decharge.findMany({
      where: {
        statut: "transit",
        demande: { station_service_id: user.station_id },
      },
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
    }));
  }

  /** Détail d'une décharge en transit avec produits modifiables. */
  async detailDecharge(id: string, user: ContexteUtilisateur) {
    if (!user.station_id) {
      throw new ForbiddenException({ code: "erreurs.aucune_station_assignee" });
    }

    const decharge = await this.prisma.decharge.findUnique({
      where: { id },
      include: {
        demande: {
          select: {
            reference: true,
            station_service_id: true,
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
        parent_decharge: { select: { numero_decharge: true } },
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
    if (decharge.demande.station_service_id !== user.station_id) {
      throw new ForbiddenException({ code: "erreurs.acces_refuse" });
    }

    const station = await this.prisma.station.findUnique({
      where: { id: user.station_id },
      select: { nom: true },
    });

    return {
      id: decharge.id,
      numero_decharge: decharge.numero_decharge,
      statut: decharge.statut,
      date_generation: decharge.date_generation,
      demande: { reference: decharge.demande.reference },
      expediteur_nom: decharge.demande.expediteur.nom_entreprise,
      station_nom: station?.nom ?? null,
      parent_decharge: decharge.parent_decharge,
      nb_produits: decharge.demande.produits.length,
      produits: decharge.demande.produits,
      mouvements: decharge.mouvements.map((m) => ({
        id: m.id,
        type_evenement: m.type_evenement,
        date_evenement: m.date_evenement,
        notes: m.notes,
        agent_email: m.agent_entrepot.email,
        emplacement: m.emplacement
          ? { zone: m.emplacement.zone, allee: m.emplacement.allee, rack: m.emplacement.rack, niveau: m.emplacement.niveau }
          : null,
      })),
    };
  }

  /** Modifier un produit d'une décharge en transit. */
  async modifierProduit(
    dechargeId: string,
    produitId: string,
    dto: ModifierProduitStationDto,
    user: ContexteUtilisateur,
    ip?: string,
  ) {
    if (!user.station_id) {
      throw new ForbiddenException({ code: "erreurs.aucune_station_assignee" });
    }

    const decharge = await this.prisma.decharge.findUnique({
      where: { id: dechargeId },
      include: { demande: { select: { station_service_id: true } } },
    });
    if (!decharge) throw new NotFoundException({ code: "erreurs.introuvable" });
    if (decharge.demande.station_service_id !== user.station_id) {
      throw new ForbiddenException({ code: "erreurs.acces_refuse" });
    }
    if (decharge.statut !== "transit") {
      throw new ConflictException({ code: "erreurs.decharge_non_transit" });
    }

    const produit = await this.prisma.produit.findFirst({
      where: { id: produitId, demande_id: decharge.demande_id },
    });
    if (!produit) throw new NotFoundException({ code: "erreurs.introuvable" });

    const avant = {
      designation: produit.designation,
      quantite: produit.quantite,
      longueur_cm: produit.longueur_cm,
      largeur_cm: produit.largeur_cm,
      hauteur_cm: produit.hauteur_cm,
      poids_kg: produit.poids_kg,
      fragile: produit.fragile,
      type_emballage: produit.type_emballage,
    };

    const donnees: Record<string, unknown> = {};
    if (dto.designation !== undefined) donnees.designation = dto.designation;
    if (dto.quantite !== undefined) donnees.quantite = dto.quantite;
    if (dto.longueur_cm !== undefined) donnees.longueur_cm = dto.longueur_cm;
    if (dto.largeur_cm !== undefined) donnees.largeur_cm = dto.largeur_cm;
    if (dto.hauteur_cm !== undefined) donnees.hauteur_cm = dto.hauteur_cm;
    if (dto.poids_kg !== undefined) donnees.poids_kg = dto.poids_kg;
    if (dto.fragile !== undefined) donnees.fragile = dto.fragile;
    if (dto.type_emballage !== undefined) donnees.type_emballage = dto.type_emballage;

    if (Object.keys(donnees).length === 0) {
      throw new ConflictException({ code: "erreurs.aucune_modification" });
    }

    const modifie = await this.prisma.produit.update({ where: { id: produitId }, data: donnees });

    await this.prisma.mouvementEntrepot.create({
      data: {
        decharge_id: dechargeId,
        agent_entrepot_id: user.sub,
        type_evenement: "controle_station",
        notes: `Modification produit ${produit.sku_code}: ${Object.keys(donnees).join(", ")}`,
      },
    });

    await this.audit.log({
      entite_type: "Produit",
      entite_id: produitId,
      action: "STATION_MODIFICATION_PRODUIT",
      utilisateur_id: user.sub,
      donnees_avant: avant as unknown as Prisma.InputJsonValue,
      donnees_apres: donnees as unknown as Prisma.InputJsonValue,
      ip_adresse: ip,
    });

    return {
      id: modifie.id,
      sku_code: modifie.sku_code,
      designation: modifie.designation,
      quantite: modifie.quantite,
      longueur_cm: modifie.longueur_cm,
      largeur_cm: modifie.largeur_cm,
      hauteur_cm: modifie.hauteur_cm,
      poids_kg: modifie.poids_kg,
      fragile: modifie.fragile,
      type_emballage: modifie.type_emballage,
    };
  }

  /**
   * Génère une décharge de transit (nouveau QR, nouveau numéro)
   * liée à la décharge originale via parent_decharge_id.
   */
  async genererTransit(dechargeId: string, dto: GenererTransitDto, user: ContexteUtilisateur, ip?: string) {
    if (!user.station_id) {
      throw new ForbiddenException({ code: "erreurs.aucune_station_assignee" });
    }

    const decharge = await this.prisma.decharge.findUnique({
      where: { id: dechargeId },
      include: {
        demande: {
          select: {
            id: true,
            reference: true,
            station_service_id: true,
            expediteur: { select: { nom_entreprise: true } },
            produits: { where: { statut_validation: "approuve" } },
          },
        },
      },
    });
    if (!decharge) throw new NotFoundException({ code: "erreurs.introuvable" });
    if (decharge.demande.station_service_id !== user.station_id) {
      throw new ForbiddenException({ code: "erreurs.acces_refuse" });
    }
    if (decharge.statut !== "transit") {
      throw new ConflictException({ code: "erreurs.decharge_non_transit" });
    }

    const nonce = randomUUID();
    const expiration = Math.floor(Date.now() / 1000) + env.dechargeTtlHeures * 3600;
    const qrCode = await this.genererQrCode();

    const nouvelleDecharge = await this.prisma.$transaction(async (tx) => {
      const id = randomUUID();
      const numero = await this.genererNumero(tx);
      return tx.decharge.create({
        data: {
          id,
          demande_id: decharge.demande_id,
          parent_decharge_id: dechargeId,
          numero_decharge: numero,
          qr_token: jwt.sign({ decharge_id: id, exp: expiration, nonce }, env.privateKey(), { algorithm: "RS256" }),
          qr_code: qrCode,
          nonce,
          statut: "emise",
        },
      });
    });

    await this.prisma.mouvementEntrepot.create({
      data: {
        decharge_id: nouvelleDecharge.id,
        agent_entrepot_id: user.sub,
        type_evenement: "decharge_transit_generee",
        notes: dto.notes?.trim() || null,
      },
    });

    await this.audit.log({
      entite_type: "Decharge",
      entite_id: nouvelleDecharge.id,
      action: "STATION_GENERATION_DECHARGE_TRANSIT",
      utilisateur_id: user.sub,
      donnees_apres: {
        numero: nouvelleDecharge.numero_decharge,
        parent: decharge.numero_decharge,
        demande: decharge.demande.reference,
      },
      ip_adresse: ip,
    });

    return {
      decharge_id: nouvelleDecharge.id,
      numero_decharge: nouvelleDecharge.numero_decharge,
      qr_code: nouvelleDecharge.qr_code,
    };
  }

  /** Génère les données des étiquettes (une par unité de quantité). */
  async preparerEtiquettes(dechargeId: string, user: ContexteUtilisateur, ip?: string) {
    if (!user.station_id) {
      throw new ForbiddenException({ code: "erreurs.aucune_station_assignee" });
    }

    const decharge = await this.prisma.decharge.findUnique({
      where: { id: dechargeId },
      include: {
        demande: {
          select: {
            reference: true,
            station_service_id: true,
            produits: {
              where: { statut_validation: "approuve" },
              orderBy: { sku_code: "asc" },
              select: {
                id: true,
                sku_code: true,
                designation: true,
                quantite: true,
                type_emballage: true,
              },
            },
          },
        },
      },
    });
    if (!decharge) throw new NotFoundException({ code: "erreurs.introuvable" });
    if (decharge.demande.station_service_id !== user.station_id) {
      throw new ForbiddenException({ code: "erreurs.acces_refuse" });
    }

    const station = await this.prisma.station.findUnique({
      where: { id: user.station_id },
      select: { nom: true },
    });

    const etiquettes: Array<{
      id: string;
      sac_numero: number;
      sac_total: number;
      sku_code: string;
      designation: string;
      quantite: number;
      decharge_numero: string;
      demande_reference: string;
      station_nom: string;
    }> = [];

    let compteur = 0;
    for (const p of decharge.demande.produits) {
      for (let i = 1; i <= p.quantite; i++) {
        compteur++;
        etiquettes.push({
          id: `${dechargeId}-${p.id}-${i}`,
          sac_numero: compteur,
          sac_total: 0,
          sku_code: p.sku_code,
          designation: p.designation,
          quantite: 1,
          decharge_numero: decharge.numero_decharge,
          demande_reference: decharge.demande.reference,
          station_nom: station?.nom ?? "",
        });
      }
    }

    for (const e of etiquettes) {
      e.sac_total = etiquettes.length;
    }

    await this.prisma.mouvementEntrepot.create({
      data: {
        decharge_id: dechargeId,
        agent_entrepot_id: user.sub,
        type_evenement: "etiquette_imprimee",
        notes: `${etiquettes.length} étiquette(s) imprimée(s)`,
      },
    });

    await this.audit.log({
      entite_type: "Decharge",
      entite_id: dechargeId,
      action: "STATION_IMPRESSION_ETIQUETTES",
      utilisateur_id: user.sub,
      donnees_apres: { nb_etiquettes: etiquettes.length },
      ip_adresse: ip,
    });

    return etiquettes;
  }

  private async genererNumero(tx: Prisma.TransactionClient) {
    const annee = new Date().getFullYear();
    for (let tentative = 0; tentative < 5; tentative++) {
      const nb = await tx.decharge.count({
        where: { date_generation: { gte: new Date(`${annee}-01-01`), lt: new Date(`${annee + 1}-01-01`) } },
      });
      const numero = `DEC-${annee}-${String(nb + 1).padStart(5, "0")}`;
      const existe = await this.prisma.decharge.findUnique({ where: { numero_decharge: numero }, select: { id: true } });
      if (!existe) return numero;
    }
    return `DEC-${annee}-${Date.now()}`;
  }

  private async genererQrCode() {
    const CARACT = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let tentative = 0; tentative < 10; tentative++) {
      let code = "";
      for (let i = 0; i < 8; i++) code += CARACT[Math.floor(Math.random() * CARACT.length)];
      const existe = await this.prisma.decharge.findUnique({ where: { qr_code: code }, select: { id: true } });
      if (!existe) return code;
    }
    return `QR${Date.now()}`.slice(0, 8);
  }
}
