"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { DemandeListeDTO, StatutDemande } from "@navex/contracts";
import { listerDemandes } from "@/lib/api-client";
import { formaterDate, messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";

const STATUTS_FILTRABLES: Array<{ value: StatutDemande | ""; label: string }> = [
  { value: "", label: "filter.tous" },
  { value: "en_attente", label: "statuts.en_attente" },
  { value: "approuvee", label: "statuts.approuvee" },
  { value: "rejetee", label: "statuts.rejetee" },
];

export default function PageMesDemandes() {
  const t = useTranslations();
  const locale = useLocale();

  const [demandes, setDemandes] = useState<DemandeListeDTO[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<StatutDemande | "">("");

  const charger = useCallback(() => {
    listerDemandes()
      .then(setDemandes)
      .catch((e) => setErreur(messageErreur(t, e)))
      .finally(() => undefined);
  }, [t]);

  useEffect(charger, [charger]);

  const demandesFiltrees = useMemo(() => {
    if (!demandes) return [];
    const q = recherche.toLowerCase().trim();
    return demandes.filter((d) => {
      if (filtreStatut && d.statut !== filtreStatut) return false;
      if (q) {
        return (
          d.reference.toLowerCase().includes(q) ||
          d.expediteur.nom_entreprise.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [demandes, recherche, filtreStatut]);

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-navex-ink">{t("demandes.titre")}</h1>
          <a
            href="/mes-demandes/nouvelle"
            className="rounded-full bg-navex-red px-6 py-2.5 text-sm font-semibold text-white shadow-glow-red transition-all duration-200 hover:bg-navex-red-dark hover:shadow-lg"
          >
            {t("demandes.nouvelle")}
          </a>
        </div>

        {erreur && (
          <p role="alert" className="rounded-2xl bg-navex-red-soft/80 px-4 py-2.5 text-sm text-navex-red-dark backdrop-blur-sm">
            {erreur}
          </p>
        )}

        {/* Barre de recherche + filtres */}
        {demandes && demandes.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-neutral-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder={t("filter.rechercher")}
                className="w-full rounded-2xl border border-neutral-200/80 bg-white/60 py-2.5 ps-10 pe-4 text-sm shadow-soft transition-all placeholder:text-neutral-400 focus:border-navex-red/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navex-red/10"
              />
            </div>
            <div className="flex gap-1 rounded-full bg-navex-stone/80 p-1 backdrop-blur-sm">
              {STATUTS_FILTRABLES.map((s) => (
                <button key={s.value} onClick={() => setFiltreStatut(s.value as StatutDemande | "")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                    filtreStatut === s.value ? "bg-white text-navex-ink shadow-soft" : "text-neutral-400 hover:text-navex-ink"
                  }`}>
                  {t(s.label)}
                </button>
              ))}
            </div>
          </div>
        )}

        {!demandes && !erreur && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-navex-red border-t-transparent" />
          </div>
        )}

        {demandes && demandesFiltrees.length === 0 && (
          <p className="card-glass rounded-3xl p-10 text-center text-sm text-neutral-500">
            {recherche || filtreStatut ? t("filter.aucun_resultat") : t("demandes.vide")}
          </p>
        )}

        {demandesFiltrees.length > 0 && (
          <ul className="space-y-3">
            {demandesFiltrees.map((d) => (
              <li key={d.id} className="card-glass rounded-3xl p-5 animate-slide-up">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-navex-ink" dir="ltr">
                        {d.reference}
                      </span>
                      <StatusBadge statut={d.statut} />
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">
                      {t("demandes.date_creation")} {formaterDate(d.date_creation, locale)} ·{" "}
                      {t("demandes.produits_col")}: {d._count?.produits ?? 0}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-end text-xs text-neutral-400">
                      <span>{t("demandes.decharge_col")} : </span>
                      {d.decharge ? (
                        <span className="font-medium text-navex-ink" dir="ltr">
                          {d.decharge.numero_decharge}
                        </span>
                      ) : (
                        <span>{t("demandes.decharge_aucune")}</span>
                      )}
                    </div>
                    <Link
                      href={`/mes-demandes/${d.id}`}
                      className="rounded-full border border-navex-ink/15 px-3 py-1.5 text-sm font-medium text-navex-ink/70 transition-all duration-200 hover:border-navex-red/30 hover:bg-navex-red-soft/40 hover:text-navex-red"
                    >
                      {t("demandes.voir")}
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
