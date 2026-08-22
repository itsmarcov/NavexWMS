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
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold">{t("demandes.titre")}</h1>
          <Link
            href="/mes-demandes/nouvelle"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
          >
            {t("demandes.nouvelle")}
          </Link>
        </div>

        {erreur && (
          <p role="alert" className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {erreur}
          </p>
        )}

        {!demandes && !erreur && <p className="mt-8 text-sm text-neutral-500">{t("commun.chargement")}</p>}

        {demandes && demandes.length === 0 && (
          <p className="mt-8 rounded-xl bg-white p-8 text-center text-sm text-neutral-500 ring-1 ring-neutral-200">
            {t("demandes.vide")}
          </p>
        )}

        {demandes && demandes.length > 0 && (
          <ul className="mt-6 space-y-3">
            {demandes.map((d) => (
              <li key={d.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" dir="ltr">
                        {d.reference}
                      </span>
                      <StatusBadge statut={d.statut} />
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      {t("demandes.date_creation")} {formaterDate(d.date_creation, locale)} ·{" "}
                      {t("demandes.produits_col")}: {d._count?.produits ?? 0}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-end text-xs text-neutral-500">
                      <span>{t("demandes.decharge_col")} : </span>
                      {d.decharge ? (
                        <span className="font-medium text-neutral-800" dir="ltr">
                          {d.decharge.numero_decharge}
                        </span>
                      ) : (
                        <span>{t("demandes.decharge_aucune")}</span>
                      )}
                    </div>
                    <Link
                      href={`/mes-demandes/${d.id}`}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
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
