"use client";

import { BADGE_STATUT } from "@navex/contracts";
import { useTranslations } from "next-intl";

const COULEURS: Record<string, string> = {
  orange: "bg-orange-100 text-orange-800 ring-orange-600/20",
  vert: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  rouge: "bg-red-100 text-red-800 ring-red-600/20",
  bleu: "bg-sky-100 text-sky-800 ring-sky-600/20",
  gris: "bg-neutral-100 text-neutral-700 ring-neutral-500/20",
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
