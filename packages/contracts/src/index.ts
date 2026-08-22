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
