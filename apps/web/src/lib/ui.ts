import { ApiError } from "@/lib/api-client";

/**
 * Traduit une erreur API : le backend renvoie des codes stables (erreurs.*)
 * qui correspondent aux clés i18n.
 */
export function messageErreur(t: (cle: string) => string, erreur: unknown): string {
  if (erreur instanceof ApiError) {
    if (erreur.message === "network") return t("erreurs.reseau");
    switch (erreur.code) {
      case "erreurs.identifiants_invalides":
        return t("erreurs.identifiants_invalides");
      case "erreurs.session_expiree":
        return t("erreurs.session_expiree");
      case "erreurs.acces_refuse":
        return t("erreurs.acces_refuse");
      case "erreurs.introuvable":
        return t("erreurs.introuvable");
      case "erreurs.aucun_produit_approuve":
        return t("erreurs.aucun_produit_approuve");
      case "erreurs.decharge_deja_scannee":
        return t("erreurs.decharge_deja_scannee");
      case "erreurs.stockage_indisponible":
        return t("erreurs.stockage_indisponible");
      case "erreurs.fichier_manquant":
        return t("erreurs.fichier_manquant");
      case "erreurs.type_fichier_refuse":
        return t("erreurs.type_fichier_refuse");
      case "erreurs.trop_de_tentatives":
        return t("erreurs.trop_de_tentatives");
      case "erreurs.sku_doublon":
        return t("erreurs.sku_doublon");
      default:
        return t("erreurs.generique");
    }
  }
  return t("erreurs.generique");
}

export function formaterDate(valeur: string | Date, locale: string, avecHeure = false): string {
  const d = typeof valeur === "string" ? new Date(valeur) : valeur;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-FR", {
    dateStyle: "long",
    ...(avecHeure ? { timeStyle: "short" as const } : {}),
  }).format(d);
}
