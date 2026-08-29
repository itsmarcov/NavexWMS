import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { hash } from "bcryptjs";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreerExpediteurDto, CreerUtilisateurDto, ModifierExpediteurDto, ModifierUtilisateurDto, StatutExpediteurDto } from "./dto/admin.dto";

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
      adresse: e.adresse,
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
      prenom: u.prenom ?? null,
      nom: u.nom ?? null,
      telephone: u.telephone ?? null,
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
        prenom: dto.prenom ?? null,
        nom: dto.nom ?? null,
        telephone: dto.telephone ?? null,
      },
    });

    await this.audit.log({
      entite_type: "Utilisateur",
      entite_id: utilisateur.id,
      action: "ADMIN_UTILISATEUR_CREE",
      utilisateur_id: utilisateurId,
      donnees_apres: { email: dto.email, role: dto.role, prenom: dto.prenom, nom: dto.nom, telephone: dto.telephone },
      ip_adresse: ip,
    });

    return { id: utilisateur.id, email: utilisateur.email, role: utilisateur.role, prenom: utilisateur.prenom, nom: utilisateur.nom, telephone: utilisateur.telephone };
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

  /** Modifie un compte utilisateur (email, role, expediteur_id, actif, mot_de_passe). */
  async modifierUtilisateur(id: string, dto: ModifierUtilisateurDto, utilisateurId: string, ip?: string) {
    const utilisateur = await this.prisma.utilisateur.findUnique({ where: { id } });
    if (!utilisateur) throw new NotFoundException({ code: "erreurs.introuvable" });

    if (dto.email && dto.email !== utilisateur.email) {
      const existant = await this.prisma.utilisateur.findUnique({ where: { email: dto.email } });
      if (existant) throw new ConflictException({ code: "erreurs.email_deja_utilise" });
    }

    const donnees: Record<string, unknown> = {};
    if (dto.email !== undefined) donnees.email = dto.email;
    if (dto.role !== undefined) donnees.role = dto.role;
    if (dto.expediteur_id !== undefined) donnees.expediteur_id = dto.expediteur_id;
    if (dto.actif !== undefined) donnees.actif = dto.actif;
    if (dto.mot_de_passe) donnees.password_hash = await hash(dto.mot_de_passe, 12);
    if (dto.prenom !== undefined) donnees.prenom = dto.prenom;
    if (dto.nom !== undefined) donnees.nom = dto.nom;
    if (dto.telephone !== undefined) donnees.telephone = dto.telephone;

    if (Object.keys(donnees).length === 0) {
      throw new ConflictException({ code: "erreurs.aucune_modification" });
    }

    const modifie = await this.prisma.utilisateur.update({ where: { id }, data: donnees });

    await this.audit.log({
      entite_type: "Utilisateur",
      entite_id: id,
      action: "ADMIN_UTILISATEUR_MODIFIE",
      utilisateur_id: utilisateurId,
      donnees_avant: { email: utilisateur.email, role: utilisateur.role, actif: utilisateur.actif, prenom: utilisateur.prenom, nom: utilisateur.nom, telephone: utilisateur.telephone },
      donnees_apres: { email: modifie.email, role: modifie.role, actif: modifie.actif, prenom: modifie.prenom, nom: modifie.nom, telephone: modifie.telephone },
      ip_adresse: ip,
    });

    return { id: modifie.id, email: modifie.email, role: modifie.role, actif: modifie.actif, prenom: modifie.prenom, nom: modifie.nom, telephone: modifie.telephone };
  }

  /** Supprime un compte utilisateur. Empêche la suppression de son propre compte. */
  async supprimerUtilisateur(id: string, utilisateurId: string, ip?: string) {
    if (id === utilisateurId) {
      throw new ForbiddenException({ code: "erreurs.autosuppression_interdite" });
    }

    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id },
      include: { _count: { select: { demandes_traitees: true, mouvements: true, audit_logs: true } } },
    });
    if (!utilisateur) throw new NotFoundException({ code: "erreurs.introuvable" });

    const totalLiens = utilisateur._count.demandes_traitees + utilisateur._count.mouvements + utilisateur._count.audit_logs;
    if (totalLiens > 0) {
      // Soft delete : on désactive le compte plutôt que de supprimer les données liées.
      await this.prisma.utilisateur.update({ where: { id }, data: { actif: false } });

      await this.audit.log({
        entite_type: "Utilisateur",
        entite_id: id,
        action: "ADMIN_UTILISATEUR_DESACTIVE",
        utilisateur_id: utilisateurId,
        donnees_avant: { email: utilisateur.email, actif: utilisateur.actif },
        donnees_apres: { actif: false },
        ip_adresse: ip,
      });

      return { ok: true, desactive: true, message: "Compte désactivé (données liées préservées)." };
    }

    await this.prisma.utilisateur.delete({ where: { id } });

    await this.audit.log({
      entite_type: "Utilisateur",
      entite_id: id,
      action: "ADMIN_UTILISATEUR_SUPPRIME",
      utilisateur_id: utilisateurId,
      donnees_avant: { email: utilisateur.email, role: utilisateur.role },
      ip_adresse: ip,
    });

    return { ok: true, desactive: false };
  }

  /** Modifie un expéditeur (nom_entreprise, email, telephone, adresse, langue_preferee). */
  async modifierExpediteur(id: string, dto: ModifierExpediteurDto, utilisateurId: string, ip?: string) {
    const expediteur = await this.prisma.expediteur.findUnique({ where: { id } });
    if (!expediteur) throw new NotFoundException({ code: "erreurs.introuvable" });

    if (dto.email && dto.email !== expediteur.email) {
      const existant = await this.prisma.expediteur.findUnique({ where: { email: dto.email } });
      if (existant) throw new ConflictException({ code: "erreurs.email_deja_utilise" });
    }

    const donnees: Record<string, unknown> = {};
    if (dto.nom_entreprise !== undefined) donnees.nom_entreprise = dto.nom_entreprise;
    if (dto.email !== undefined) donnees.email = dto.email;
    if (dto.telephone !== undefined) donnees.telephone = dto.telephone;
    if (dto.adresse !== undefined) donnees.adresse = dto.adresse;
    if (dto.langue_preferee !== undefined) donnees.langue_preferee = dto.langue_preferee;

    if (Object.keys(donnees).length === 0) {
      throw new ConflictException({ code: "erreurs.aucune_modification" });
    }

    const modifie = await this.prisma.expediteur.update({ where: { id }, data: donnees });

    await this.audit.log({
      entite_type: "Expediteur",
      entite_id: id,
      action: "ADMIN_EXPEDITEUR_MODIFIE",
      utilisateur_id: utilisateurId,
      donnees_avant: { nom_entreprise: expediteur.nom_entreprise, email: expediteur.email, telephone: expediteur.telephone },
      donnees_apres: { nom_entreprise: modifie.nom_entreprise, email: modifie.email, telephone: modifie.telephone },
      ip_adresse: ip,
    });

    return { id: modifie.id, nom_entreprise: modifie.nom_entreprise, email: modifie.email, telephone: modifie.telephone };
  }

  /** Supprime un expéditeur. Impossible s'il a des demandes liées. */
  async supprimerExpediteur(id: string, utilisateurId: string, ip?: string) {
    const expediteur = await this.prisma.expediteur.findUnique({
      where: { id },
      include: { _count: { select: { demandes: true, utilisateurs: true } } },
    });
    if (!expediteur) throw new NotFoundException({ code: "erreurs.introuvable" });

    if (expediteur._count.demandes > 0) {
      throw new ForbiddenException({ code: "erreurs.expediteur_avec_demandes" });
    }

    // Supprimer d'abord les comptes utilisateurs rattachés (sans demandes)
    await this.prisma.utilisateur.deleteMany({ where: { expediteur_id: id } });
    await this.prisma.expediteur.delete({ where: { id } });

    await this.audit.log({
      entite_type: "Expediteur",
      entite_id: id,
      action: "ADMIN_EXPEDITEUR_SUPPRIME",
      utilisateur_id: utilisateurId,
      donnees_avant: { nom_entreprise: expediteur.nom_entreprise, email: expediteur.email },
      ip_adresse: ip,
    });

    return { ok: true };
  }
}
