"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { DemandeListeDTO } from "@navex/contracts";
import { listerDemandes } from "@/lib/api-client";
import { formaterDate, messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";

export default function PageMesDemandes() {
  const t = useTranslations();
  const locale = useLocale();

  const [demandes, setDemandes] = useState<DemandeListeDTO[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(() => {
    listerDemandes()
      .then(setDemandes)
      .catch((e) => setErreur(messageErreur(t, e)))
      .finally(() => undefined);
  }, [t]);

  useEffect(charger, [charger]);

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

        {!demandes && !erreur && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-navex-red border-t-transparent" />
          </div>
        )}

        {demandes && demandes.length === 0 && (
          <p className="card-glass rounded-3xl p-10 text-center text-sm text-neutral-500">
            {t("demandes.vide")}
          </p>
        )}

        {demandes && demandes.length > 0 && (
          <ul className="space-y-3">
            {demandes.map((d) => (
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
