import type {
  DemandeDetailDTO,
  DemandeListeDTO,
  DechargeResumeDTO,
  LoginResponse,
  NouveauProduit,
  UtilisateurDTO,
} from "@navex/contracts";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
const CLE_TOKEN = "navex_access_token";
export const COOKIE_ACCES = "navex_access";

export class ApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

function definirCookiePresence(token: string) {
  const maxAge = 60 * 15; // aligné sur JWT_ACCESS_TTL_SECONDS
  document.cookie = `${COOKIE_ACCES}=${token}; path=/; max-age=${maxAge}; samesite=lax`;
}

function supprimerCookiePresence() {
  document.cookie = `${COOKIE_ACCES}=; path=/; max-age=0`;
}

async function requete<T>(chemin: string, options: RequestInit = {}, reessayer = true): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem(CLE_TOKEN) : null;

  let reponse: Response;
  try {
    reponse = await fetch(`${BASE}${chemin}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError("network");
  }

  // Access token expiré → tentative de refresh via cookie httpOnly, puis un seul nouvel essai.
  if (reponse.status === 401 && reessayer && !chemin.startsWith("/auth/login")) {
    const rafraichi = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (rafraichi.ok) {
      const donnees = (await rafraichi.json()) as LoginResponse;
      localStorage.setItem(CLE_TOKEN, donnees.access_token);
      definirCookiePresence(donnees.access_token);
      return requete<T>(chemin, options, false);
    }
    localStorage.removeItem(CLE_TOKEN);
    supprimerCookiePresence();
  }

  if (!reponse.ok) {
    let code: string | undefined;
    try {
      const corps = await reponse.json();
      code = typeof corps?.message === "object" ? corps.message?.code : undefined;
    } catch {
      // corps non JSON
    }
    throw new ApiError(`HTTP ${reponse.status}`, code);
  }

  return (await reponse.json()) as T;
}

export function seConnecter(email: string, motDePasse: string) {
  return requete<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: motDePasse }),
  });
}

export async function utilisateurCourant() {
  try {
    return await requete<UtilisateurDTO>("/auth/me");
  } catch (erreur) {
    if (erreur instanceof ApiError && erreur.code === "erreurs.session_expiree") {
      localStorage.removeItem(CLE_TOKEN);
      supprimerCookiePresence();
    }
    throw erreur;
  }
}

export async function seDeconnecter() {
  try {
    await requete<{ ok: boolean }>("/auth/logout", { method: "POST" }, false);
  } finally {
    localStorage.removeItem(CLE_TOKEN);
    supprimerCookiePresence();
  }
}

// ── Demandes de stockage (Phase 2) ───────────────────────────

export function creerDemande(produits: NouveauProduit[]) {
  return requete<DemandeDetailDTO>("/demandes", {
    method: "POST",
    body: JSON.stringify({ produits }),
  });
}

export function listerDemandes() {
  return requete<DemandeListeDTO[]>("/demandes");
}

export function detailDemande(id: string) {
  return requete<DemandeDetailDTO>(`/demandes/${id}`);
}

export function genererDecharge(demandeId: string) {
  return requete<DechargeResumeDTO>("/decharges/generate", {
    method: "POST",
    body: JSON.stringify({ demande_id: demandeId }),
  });
}

/** Télécharge le PDF via fetch authentifié puis déclenche l'enregistrement côté navigateur. */
export async function telechargerDechargePdf(dechargeId: string, nomFichier: string) {
  const token = localStorage.getItem(CLE_TOKEN);
  const reponse = await fetch(`${BASE}/decharges/${dechargeId}/pdf`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!reponse.ok) throw new ApiError(`HTTP ${reponse.status}`);

  const blob = await reponse.blob();
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.append(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}

/** Envoie une photo produit vers le stockage S3/MinIO, renvoie son URL publique. */
export async function uploaderPhoto(fichier: File) {
  const token = localStorage.getItem(CLE_TOKEN);
  const donnees = new FormData();
  donnees.append("photo", fichier);

  const reponse = await fetch(`${BASE}/uploads/photos`, {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: donnees,
  });
  if (!reponse.ok) {
    let code: string | undefined;
    try {
      code = ((await reponse.json()) as { message?: { code?: string } })?.message?.code;
    } catch {
      // corps non JSON
    }
    throw new ApiError(`HTTP ${reponse.status}`, code);
  }
  return (await reponse.json()) as { url: string };
}
