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
  en_attente: { couleur: "orange" },
  approuvee: { couleur: "vert" },
  approuve: { couleur: "vert" },
  refuse: { couleur: "rouge" },
  rejetee: { couleur: "rouge" },
  annulee: { couleur: "gris" },
  emise: { couleur: "bleu" },
  scannee: { couleur: "vert" },
  expiree: { couleur: "gris" },
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
