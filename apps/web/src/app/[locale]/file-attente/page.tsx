"use client";

import { useCallback, useEffect, useState } from "react";
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

  const charger = useCallback(() => {
    listerDemandes(true)
      .then(setDemandes)
      .catch((e) => setErreur(messageErreur(t, e)));
  }, [t]);

  useEffect(charger, [charger]);

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

        <ul className="space-y-3">
          {(demandes ?? []).map((d) => {
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
