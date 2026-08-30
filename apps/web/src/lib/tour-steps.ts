import type { Role } from "@navex/contracts";

export interface TourStep {
  /** Sélecteur DOM ou data-tour="..." */
  target: string;
  /** Clé i18n : tour.{role}.{step}.title */
  titleKey: string;
  /** Clé i18n : tour.{role}.{step}.desc */
  descKey: string;
  /** Nom de l'icône Tabler (sans le prefixe ti-) */
  icon: string;
}

/**
 * Étapes du parcours interactif par rôle.
 * Chaque step pointe vers un data-tour="..." ou un sélecteur CSS réel.
 * Les textes sont dans fr.json / ar.json sous la clé "tour".
 */
export const TOUR_STEPS: Record<Role, TourStep[]> = {
  // ─── Expéditeur : 3 étapes ────────────────────────────
  // 1) Lien "Mes demandes" dans la nav header
  // 2) Bouton "Nouvelle demande" sur le dashboard
  // 3) Une carte de demande dans la liste des dernières
  expediteur: [
    {
      target: '[data-tour="nav-mes-demandes"]',
      titleKey: "tour.expediteur.step1.title",
      descKey: "tour.expediteur.step1.desc",
      icon: "list",
    },
    {
      target: '[data-tour="exp-new-demand"]',
      titleKey: "tour.expediteur.step2.title",
      descKey: "tour.expediteur.step2.desc",
      icon: "plus",
    },
    {
      target: '[data-tour="exp-demand-row"]',
      titleKey: "tour.expediteur.step3.title",
      descKey: "tour.expediteur.step3.desc",
      icon: "package",
    },
  ],

  // ─── Agent commercial : 3 étapes ──────────────────────
  // 1) Section file d'attente sur le dashboard
  // 2) Bouton d'approbation produit (détail d'une demande)
  // 3) Bouton "Générer la décharge" (détail d'une demande)
  agent_commercial: [
    {
      target: '[data-tour="ac-queue-section"]',
      titleKey: "tour.agent_commercial.step1.title",
      descKey: "tour.agent_commercial.step1.desc",
      icon: "list-check",
    },
    {
      target: '[data-tour="demande-approve-btn"]',
      titleKey: "tour.agent_commercial.step2.title",
      descKey: "tour.agent_commercial.step2.desc",
      icon: "circle-check",
    },
    {
      target: '[data-tour="demande-generate-decharge"]',
      titleKey: "tour.agent_commercial.step3.title",
      descKey: "tour.agent_commercial.step3.desc",
      icon: "file-text",
    },
  ],

  // ─── Agent entrepôt : 3 étapes ────────────────────────
  // 1) Champ de scan QR
  // 2) Bouton "Confirmer réception" (détail décharge)
  // 3) Sélecteur d'emplacement (détail décharge)
  agent_entrepot: [
    {
      target: '[data-tour="entrepot-scan-input"]',
      titleKey: "tour.agent_entrepot.step1.title",
      descKey: "tour.agent_entrepot.step1.desc",
      icon: "scan",
    },
    {
      target: '[data-tour="decharge-confirm-reception-btn"]',
      titleKey: "tour.agent_entrepot.step2.title",
      descKey: "tour.agent_entrepot.step2.desc",
      icon: "package-check",
    },
    {
      target: '[data-tour="decharge-emplacement-select"]',
      titleKey: "tour.agent_entrepot.step3.title",
      descKey: "tour.agent_entrepot.step3.desc",
      icon: "map-pin",
    },
  ],

  // ─── Admin : 3 étapes ─────────────────────────────────
  // 1) Onglet "Statistiques" dans le panneau admin
  // 2) Liste des expéditeurs (gestion des comptes)
  // 3) Tableau des utilisateurs (historique / audit)
  admin: [
    {
      target: '[data-tour="admin-tab-stats"]',
      titleKey: "tour.admin.step1.title",
      descKey: "tour.admin.step1.desc",
      icon: "chart-bar",
    },
    {
      target: '[data-tour="admin-expediteurs-list"]',
      titleKey: "tour.admin.step2.title",
      descKey: "tour.admin.step2.desc",
      icon: "users",
    },
    {
      target: '[data-tour="admin-users-table"]',
      titleKey: "tour.admin.step3.title",
      descKey: "tour.admin.step3.desc",
      icon: "table",
    },
  ],
};
