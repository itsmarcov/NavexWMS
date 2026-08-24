import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { hash } from "bcryptjs";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreerExpediteurDto, CreerUtilisateurDto, StatutExpediteurDto } from "./dto/admin.dto";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** KPIs globaux pour le tableau de bord administrateur. */
  async stats() {
    const [demandesParStatut, produitsEnAttente, dechargesParStatut, emplacementsTotal, emplacementsOccupes, expediteursParStatut] =
      await Promise.all([
        this.prisma.demandeStockage.groupBy({ by: ["statut"], _count: { _all: true } }),
        this.prisma.produit.count({ where: { statut_validation: "en_attente" } }),
        this.prisma.decharge.groupBy({ by: ["statut"], _count: { _all: true } }),
        this.prisma.emplacement.count(),
        this.prisma.emplacement.count({ where: { occupee: true } }),
        this.prisma.expediteur.groupBy({ by: ["statut"], _count: { _all: true } }),
      ]);

    const versRecord = <T extends string>(lignes: Array<{ statut: T; _count: { _all: number } }>, cles: readonly T[]) =>
      Object.fromEntries(cles.map((c) => [c, lignes.find((l) => l.statut === c)?._count._all ?? 0]));

    return {
      demandes_par_statut: versRecord(demandesParStatut as never, ["en_attente", "approuvee", "rejetee", "annulee"] as const),
      produits_en_attente: produitsEnAttente,
      decharges_par_statut: versRecord(dechargesParStatut as never, ["emise", "scannee", "expiree"] as const),
      emplacements: {
        total: emplacementsTotal,
        occupes: emplacementsOccupes,
        libres: emplacementsTotal - emplacementsOccupes,
      },
      expediteurs_par_statut: versRecord(expediteursParStatut as never, ["en_attente", "actif", "suspendu"] as const),
    };
  }

  /** Liste des expéditeurs avec compteurs d'usage. */
  async listerExpediteurs() {
    const expediteurs = await this.prisma.expediteur.findMany({
      orderBy: { date_creation: "asc" },
      include: {
        _count: { select: { utilisateurs: true, demandes: true } },
      },
    });

    return expediteurs.map((e) => ({
      id: e.id,
      nom_entreprise: e.nom_entreprise,
      email: e.email,
      telephone: e.telephone,
      statut: e.statut,
      date_creation: e.date_creation,
      nb_utilisateurs: e._count.utilisateurs,
      nb_demandes: e._count.demandes,
    }));
  }

  /** Active ou suspend un expéditeur. Un expéditeur suspendu ne peut plus créer de demandes. */
  async changerStatutExpediteur(id: string, dto: StatutExpediteurDto, utilisateurId: string, ip?: string) {
    const expediteur = await this.prisma.expediteur.findUnique({ where: { id } });
    if (!expediteur) throw new NotFoundException({ code: "erreurs.introuvable" });
    if (expediteur.statut === dto.statut) {
      throw new ConflictException({ code: "erreurs.statut_deja_actuel" });
    }

    await this.prisma.expediteur.update({ where: { id }, data: { statut: dto.statut } });

    await this.audit.log({
      entite_type: "Expediteur",
      entite_id: id,
      action: `ADMIN_STATUT_EXPEDITEUR_${dto.statut.toUpperCase()}`,
      utilisateur_id: utilisateurId,
      donnees_avant: { statut: expediteur.statut },
      donnees_apres: { statut: dto.statut },
      ip_adresse: ip,
    });

    return { ok: true, statut: dto.statut };
  }

  /** Comptes utilisateurs (lecture seule) avec leur société rattachée. */
  async listerUtilisateurs() {
    const utilisateurs = await this.prisma.utilisateur.findMany({
      orderBy: [{ role: "asc" }, { email: "asc" }],
      include: { expediteur: { select: { nom_entreprise: true } } },
    });

    return utilisateurs.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      actif: u.actif,
      date_creation: u.date_creation,
      expediteur_nom: u.expediteur?.nom_entreprise ?? null,
    }));
  }

  /** Crée un compte utilisateur (admin : tous les rôles sauf admin ; commercial : expéditeur uniquement). */
  async creerUtilisateur(
    dto: CreerUtilisateurDto,
    roleCreateur: string,
    utilisateurId: string,
    ip?: string,
  ) {
    if (roleCreateur === "agent_commercial" && dto.role !== "expediteur") {
      throw new ForbiddenException({ code: "erreurs.role_interdit" });
    }

    const existant = await this.prisma.utilisateur.findUnique({ where: { email: dto.email } });
    if (existant) throw new ConflictException({ code: "erreurs.email_deja_utilise" });

    const passwordHash = await hash(dto.mot_de_passe, 12);

    const utilisateur = await this.prisma.utilisateur.create({
      data: {
        email: dto.email,
        password_hash: passwordHash,
        role: dto.role,
        expediteur_id: dto.expediteur_id ?? null,
      },
    });

    await this.audit.log({
      entite_type: "Utilisateur",
      entite_id: utilisateur.id,
      action: "ADMIN_UTILISATEUR_CREE",
      utilisateur_id: utilisateurId,
      donnees_apres: { email: dto.email, role: dto.role },
      ip_adresse: ip,
    });

    return { id: utilisateur.id, email: utilisateur.email, role: utilisateur.role };
  }

  /** Crée un expéditeur + son premier compte utilisateur. */
  async creerExpediteur(
    dto: CreerExpediteurDto,
    roleCreateur: string,
    utilisateurId: string,
    ip?: string,
  ) {
    const existant = await this.prisma.expediteur.findUnique({ where: { email: dto.email } });
    if (existant) throw new ConflictException({ code: "erreurs.email_deja_utilise" });

    const expediteur = await this.prisma.$transaction(async (tx) => {
      const exp = await tx.expediteur.create({
        data: {
          nom_entreprise: dto.nom_entreprise,
          email: dto.email,
          telephone: dto.telephone,
          adresse: dto.adresse,
          langue_preferee: dto.langue_preferee ?? "fr",
          statut: roleCreateur === "admin" ? "actif" : "en_attente",
        },
      });

      const passwordHash = await hash("Navex@2026", 12);
      await tx.utilisateur.create({
        data: {
          email: dto.email,
          password_hash: passwordHash,
          role: "expediteur",
          expediteur_id: exp.id,
        },
      });

      return exp;
    });

    await this.audit.log({
      entite_type: "Expediteur",
      entite_id: expediteur.id,
      action: "ADMIN_EXPEDITEUR_CREE",
      utilisateur_id: utilisateurId,
      donnees_apres: { nom_entreprise: dto.nom_entreprise, email: dto.email },
      ip_adresse: ip,
    });

    return {
      id: expediteur.id,
      nom_entreprise: expediteur.nom_entreprise,
      email: expediteur.email,
      statut: expediteur.statut,
      mot_de_passe_defaut: "Navex@2026",
    };
  }
}
