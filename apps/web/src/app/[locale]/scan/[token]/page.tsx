"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ScanResultDTO } from "@navex/contracts";
import { scannerQr } from "@/lib/api-client";
import { messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";

type Etat =
  | { kind: "chargement" }
  | { kind: "ok"; resultat: ScanResultDTO }
  | { kind: "erreur"; code?: string };

export default function PageScan() {
  const t = useTranslations();
  const paramsRoute = useParams<{ token: string }>();
  const [etat, setEtat] = useState<Etat>({ kind: "chargement" });
  const lance = useRef(false);

  useEffect(() => {
    if (lance.current || !paramsRoute?.token) return;
    lance.current = true;

    scannerQr(paramsRoute.token)
      .then((resultat) => setEtat({ kind: "ok", resultat }))
      .catch((e) => setEtat({ kind: "erreur", code: e.code }));
  }, [paramsRoute]);

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 py-10 space-y-6">
        <h1 className="text-xl font-bold">{t("scan.titre")}</h1>

        {etat.kind === "chargement" && (
          <p className="text-sm text-neutral-500">{t("commun.chargement")}</p>
        )}

        {etat.kind === "erreur" && (
          <div className="space-y-4 rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-red-200">
            <p className="text-4xl" aria-hidden>
              ✗
            </p>
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {etat.code && etat.code.startsWith("erreurs.") ? t(etat.code) : messageErreur(t, new Error("generique"))}
            </p>
            <Link
              href="/entrepot"
              className="inline-block rounded-lg border border-neutral-900 px-4 py-2 text-sm font-semibold hover:bg-neutral-100"
            >
              {t("entrepot.retour_tableau")}
            </Link>
          </div>
        )}

        {etat.kind === "ok" && (
          <div className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-green-200">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-xl text-green-700" aria-hidden>
                ✓
              </span>
              <p className="font-semibold text-green-800">{t("scan.arrivee_confirmee")}</p>
            </div>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-neutral-400">{t("demandes.decharge_col")}</dt>
                <dd className="mt-0.5 font-medium" dir="ltr">
                  {etat.resultat.numero_decharge}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-neutral-400">{t("demandes.reference")}</dt>
                <dd className="mt-0.5 font-medium" dir="ltr">
                  {etat.resultat.demande_reference}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-neutral-400">{t("demandes.expediteur_col")}</dt>
                <dd className="mt-0.5">{etat.resultat.expediteur_nom}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-neutral-400">{t("file_attente.produits_approuves")}</dt>
                <dd className="mt-0.5" dir="ltr">
                  {etat.resultat.nb_produits}
                </dd>
              </div>
            </dl>

            <Link
              href={`/entrepot/decharges/${etat.resultat.decharge_id}`}
              className="block rounded-lg bg-neutral-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-neutral-700"
            >
              {t("entrepot.traiter_decharge")}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
