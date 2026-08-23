export const ROLES = ["expediteur", "agent_commercial", "agent_entrepot", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const STATUTS_DEMANDE = ["en_attente", "approuvee", "rejetee", "annulee"] as const;
export type StatutDemande = (typeof STATUTS_DEMANDE)[number];

export const STATUTS_VALIDATION_PRODUIT = ["en_attente", "approuve", "refuse"] as const;
export type StatutValidationProduit = (typeof STATUTS_VALIDATION_PRODUIT)[number];

export const STATUTS_DECHARGE = ["emise", "scannee", "expiree"] as const;
export type StatutDecharge = (typeof STATUTS_DECHARGE)[number];

export const TYPES_EMBALLAGE = ["carton", "palette", "sac", "autre"] as const;
export type TypeEmballage = (typeof TYPES_EMBALLAGE)[number];

/** Badges statut cohérents : en_attente=orange, approuvé=vert, refusé=rouge */
export const BADGE_STATUT: Record<string, { couleur: string }> = {
  // Charte Navex : une seule teinte rouge par intensité (soft / plein),
  // le reste en neutres (encre noire / gris pierre).
  en_attente: { couleur: "rouge_soft" },
  emise: { couleur: "rouge_soft" },
  approuvee: { couleur: "noir" },
  approuve: { couleur: "noir" },
  scannee: { couleur: "noir" },
  refuse: { couleur: "rouge_plein" },
  rejetee: { couleur: "rouge_plein" },
  suspendu: { couleur: "rouge_plein" },
  annulee: { couleur: "gris" },
  expiree: { couleur: "gris" },
  inactif: { couleur: "gris" },
};

export interface UtilisateurDTO {
  id: string;
  email: string;
  role: Role;
  expediteur_id?: string | null;
}

export interface LoginResponse {
  access_token: string;
  utilisateur: UtilisateurDTO;
}

// ── Demandes / Produits / Décharges ──────────────────────────

export type TypeEmballageDTO = (typeof TYPES_EMBALLAGE)[number];

export interface ProduitDTO {
  id: string;
  sku_code: string;
  designation: string;
  longueur_cm: number;
  largeur_cm: number;
  hauteur_cm: number;
  poids_kg: number;
  fragile: boolean;
  type_emballage: TypeEmballageDTO;
  quantite: number;
  photo_url?: string | null;
  statut_validation: StatutValidationProduit;
  commentaire?: string | null;
  date_validation?: string | null;
}

export interface DechargeResumeDTO {
  id: string;
  numero_decharge: string;
  statut: StatutDecharge;
}

export interface DemandeListeDTO {
  id: string;
  reference: string;
  statut: StatutDemande;
  date_creation: string;
  expediteur: { id: string; nom_entreprise: string };
  _count?: { produits: number };
  decharge?: DechargeResumeDTO | null;
  compteurs?: { en_attente: number; approuve: number; refuse: number };
  /** Statuts produits — présent quand la liste est filtrée sur la file d'attente. */
  produits?: Array<{ statut_validation: StatutValidationProduit }>;
}

/** Décision de l'agent commercial sur un produit. */
export interface ValidationProduitPayload {
  statut_validation: Exclude<StatutValidationProduit, "en_attente">;
  commentaire?: string;
}

/** Planification de la réception physique par l'agent commercial. */
export interface PlanificationPayload {
  date_reception_prevue: string; // ISO 8601
}

// ── Module entrepôt (Phase 4) ────────────────────────────────

export const TYPES_EVENEMENT = ["arrivee_scannee", "reception_confirmee", "repositionnement"] as const;
export type TypeEvenement = (typeof TYPES_EVENEMENT)[number];

export interface ScanQrPayload {
  qr_token: string;
}

export interface ReceptionPayload {
  notes?: string;
}

export interface PositionnementPayload {
  emplacement_id: string;
  notes?: string;
}

export interface ScanResultDTO {
  decharge_id: string;
  numero_decharge: string;
  demande_reference: string;
  expediteur_nom: string;
  nb_produits: number;
}

export interface DechargeEntrepotListeDTO {
  id: string;
  numero_decharge: string;
  statut: StatutDecharge;
  date_generation: string;
  demande: { reference: string };
  expediteur_nom: string;
  nb_produits: number;
  /** Types d'événements déjà enregistrés — permet de déduire l'étape suivante. */
  evenements: TypeEvenement[];
}

export interface MouvementDTO {
  id: string;
  type_evenement: TypeEvenement;
  date_evenement: string;
  notes?: string | null;
  agent_email: string;
  emplacement?: { zone: string; allee: string; rack: string; niveau: string } | null;
}

export interface DechargeEntrepotDetailDTO extends Omit<DechargeEntrepotListeDTO, "evenements"> {
  produits: Array<Pick<
    ProduitDTO,
    "id" | "sku_code" | "designation" | "quantite" | "longueur_cm" | "largeur_cm" | "hauteur_cm" | "poids_kg" | "fragile" | "type_emballage"
  >>;
  mouvements: MouvementDTO[];
}

export interface EmplacementDTO {
  id: string;
  zone: string;
  allee: string;
  rack: string;
  niveau: string;
  capacite_max: number;
  occupee: boolean;
}

// ── Module admin (Phase 5) ───────────────────────────────────

export const STATUTS_EXPEDITEUR = ["en_attente", "actif", "suspendu"] as const;
export type StatutExpediteur = (typeof STATUTS_EXPEDITEUR)[number];

export interface AdminStatsDTO {
  demandes_par_statut: Record<StatutDemande, number>;
  produits_en_attente: number;
  decharges_par_statut: Record<StatutDecharge, number>;
  emplacements: { total: number; occupes: number; libres: number };
  expediteurs_par_statut: Record<StatutExpediteur, number>;
}

export interface ExpediteurAdminDTO {
  id: string;
  nom_entreprise: string;
  email: string;
  telephone: string;
  statut: StatutExpediteur;
  date_creation: string;
  nb_utilisateurs: number;
  nb_demandes: number;
}

export interface UtilisateurAdminDTO {
  id: string;
  email: string;
  role: Role;
  actif: boolean;
  date_creation: string;
  expediteur_nom?: string | null;
}

export interface StatutExpediteurPayload {
  statut: Exclude<StatutExpediteur, never>;
}

export interface DemandeDetailDTO extends Omit<DemandeListeDTO, "_count"> {
  commentaire_agent?: string | null;
  date_reception_prevue?: string | null;
  date_traitement?: string | null;
  produits: ProduitDTO[];
  decharge?:
    | (DechargeResumeDTO & { date_generation: string; pdf_url?: string | null })
    | null;
}

/** Charge utile de création : le backend génère référence et statuts. */
export interface NouveauProduit {
  sku_code: string;
  designation: string;
  longueur_cm: number;
  largeur_cm: number;
  hauteur_cm: number;
  poids_kg: number;
  fragile: boolean;
  type_emballage: TypeEmballageDTO;
  quantite: number;
  photo_url?: string | null;
}
