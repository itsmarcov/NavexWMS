"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { DemandeListeDTO } from "@navex/contracts";
import { listerDemandes } from "@/lib/api-client";
import { formaterDate, messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";

export default function PageFileAttente() {
  const t = useTranslations();
  const locale = useLocale();
  const [demandes, setDemandes] = useState<DemandeListeDTO[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");

  const charger = useCallback(() => {
    listerDemandes(true)
      .then(setDemandes)
      .catch((e) => setErreur(messageErreur(t, e)));
  }, [t]);

  useEffect(charger, [charger]);

  const demandesFiltrees = useMemo(() => {
    if (!demandes) return [];
    const q = recherche.toLowerCase().trim();
    if (!q) return demandes;
    return demandes.filter((d) =>
      d.reference.toLowerCase().includes(q) ||
      d.expediteur.nom_entreprise.toLowerCase().includes(q)
    );
  }, [demandes, recherche]);

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <h1 className="text-2xl font-extrabold text-navex-ink">{t("file_attente.titre")}</h1>

        {erreur && (
          <p role="alert" className="rounded-2xl bg-navex-red-soft/80 px-4 py-2.5 text-sm text-navex-red-dark backdrop-blur-sm">
            {erreur}
          </p>
        )}

        {demandes && demandes.length > 0 && (
          <div className="relative">
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
        )}

        {!demandes && !erreur && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-navex-red border-t-transparent" />
          </div>
        )}

        {demandes?.length === 0 && (
          <div className="card-glass rounded-3xl p-10 text-center">
            <p className="text-sm text-neutral-500">{t("file_attente.vide")}</p>
          </div>
        )}

        {demandes && demandesFiltrees.length === 0 && (recherche) && (
          <div className="card-glass rounded-3xl p-10 text-center">
            <p className="text-sm text-neutral-500">{t("filter.aucun_resultat")}</p>
          </div>
        )}

        <ul className="space-y-3">
          {demandesFiltrees.map((d) => {
            const enAttente = d.produits?.filter((p) => p.statut_validation === "en_attente").length ?? 0;
            const approuves = d.produits?.filter((p) => p.statut_validation === "approuve").length ?? 0;
            const refuses = d.produits?.filter((p) => p.statut_validation === "refuse").length ?? 0;
            const totalP = d._count?.produits ?? d.produits?.length ?? 0;

            return (
              <li key={d.id} className="card-glass rounded-3xl p-5 animate-slide-up">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-40 flex-1 space-y-1">
                    <p className="font-semibold text-navex-ink" dir="ltr">
                      <Link href={`/mes-demandes/${d.id}`} className="hover:underline">
                        {d.reference}
                      </Link>
                    </p>
                    <p className="text-sm text-neutral-600">{d.expediteur.nom_entreprise}</p>
                    <p className="text-xs text-neutral-400">
                      {t("demandes.date_creation")} : {formaterDate(d.date_creation, locale, true)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge statut={d.statut} />
                    <p className="text-xs text-neutral-400" dir="ltr">
                      {t("file_attente.progression", {
                        traites: approuves + refuses,
                        total: totalP,
                      })}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs" dir={locale === "ar" ? "rtl" : "ltr"}>
                  <span className="rounded-full bg-navex-red-soft/80 px-2.5 py-1 font-medium text-navex-red-dark backdrop-blur-sm">
                    {enAttente} {t("file_attente.a_traiter")}
                  </span>
                  <span className="rounded-full bg-navex-stone/80 px-2.5 py-1 font-medium text-navex-ink backdrop-blur-sm">
                    {approuves} {t("file_attente.approuves")}
                  </span>
                  <span className="rounded-full bg-navex-red/90 px-2.5 py-1 font-medium text-white backdrop-blur-sm">
                    {refuses} {t("file_attente.refuses")}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
