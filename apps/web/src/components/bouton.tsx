"use client";

import { Link } from "@/i18n/navigation";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export type VarianteBouton = "primaire" | "secondaire";

/**
 * Charte Navex :
 * - primaire   : fond #C81E1E, texte blanc, pilule — l'action principale de l'écran
 * - secondaire : fond blanc, bordure fine noire, texte noir — actions secondaires
 */
const VARIANTES: Record<VarianteBouton, string> = {
  primaire:
    "bg-navex-red text-white hover:bg-navex-red-dark focus-visible:outline-navex-red disabled:hover:bg-navex-red",
  secondaire:
    "bg-white text-navex-ink border border-navex-ink hover:bg-navex-stone focus-visible:outline-navex-ink disabled:hover:bg-white",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

/** Classes brutes, pour habiller un <Link> ou un élément existant avec le même style. */
export function classesBouton(variante: VarianteBouton = "primaire", extra?: string) {
  return `${BASE} ${VARIANTES[variante]}${extra ? ` ${extra}` : ""}`;
}

type PropsCommuns = {
  variante?: VarianteBouton;
  children: ReactNode;
};

type PropsBouton = PropsCommuns &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
    className?: string;
  };

type PropsLien = PropsCommuns &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> & {
    href: string;
    className?: string;
  };

export function Bouton(props: PropsBouton | PropsLien) {
  const { variante = "primaire", className, children, href, ...reste } = props;
  const classes = classesBouton(variante, className);

  if (href !== undefined) {
    return (
      <Link href={href} className={classes} {...(reste as Omit<PropsLien, "href">)}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...(reste as Omit<PropsBouton, "href">)}>
      {children}
    </button>
  );
}
