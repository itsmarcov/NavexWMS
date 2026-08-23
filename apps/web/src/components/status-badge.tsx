"use client";

import { BADGE_STATUT } from "@navex/contracts";
import { useTranslations } from "next-intl";

/**
 * Palette de badges — charte Navex :
 * rouge_plein : états bloquants (refusé, suspendu) — blanc sur #C81E1E (contraste 5,9:1, AA)
 * rouge_soft  : états en attente — texte #7F1414 sur #FBE4E4 (contraste > 8:1)
 * noir        : états confirmés (approuvé, scanné, actif)
 * gris        : états neutres / terminés sans décision (annulé, expiré, inactif)
 */
const COULEURS: Record<string, string> = {
  rouge_plein: "bg-navex-red text-white ring-navex-red",
  rouge_soft: "bg-navex-red-soft text-navex-red-dark ring-navex-red/30",
  noir: "bg-navex-ink text-white ring-navex-ink",
  gris: "bg-navex-stone text-navex-ink ring-neutral-300",
};

export function StatusBadge({ statut }: { statut: string }) {
  const t = useTranslations("statuts");
  const couleur = BADGE_STATUT[statut]?.couleur ?? "gris";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${COULEURS[couleur]}`}
    >
      {t(statut)}
    </span>
  );
}
