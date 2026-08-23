"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { DechargeEntrepotListeDTO } from "@navex/contracts";
import { listerDechargesEntrepot } from "@/lib/api-client";
import { formaterDate, messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";

function EtapeBadge({ evenements, libelle }: { evenements: string[]; libelle: string }) {
  if (!evenements.includes("reception_confirmee")) {
    return (
      <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-800">
        {libelle}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">
      {libelle}
    </span>
  );
}

export default function PageEntrepot() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [decharges, setDecharges] = useState<DechargeEntrepotListeDTO[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [token, setToken] = useState("");

  const charger = useCallback(() => {
    listerDechargesEntrepot()
      .then(setDecharges)
      .catch((e) => setErreur(messageErreur(t, e)));
  }, [t]);

  useEffect(charger, [charger]);

  const enAttenteReception =
    decharges?.filter((d) => !d.evenements.includes("reception_confirmee")).length ?? 0;
  const enAttentePositionnement =
    decharges?.filter(
      (d) => d.evenements.includes("reception_confirmee") && !d.evenements.includes("repositionnement"),
    ).length ?? 0;

  function scannerManuel() {
    const jeton = token.trim();
    if (jeton) router.push(`/scan?t=${encodeURIComponent(jeton)}`);
  }

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <h1 className="text-xl font-bold">{t("entrepot.titre")}</h1>

        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {erreur}
          </p>
        )}

        {/* Scan manuel : collage du contenu du QR */}
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-3 text-sm font-semibold">{t("scan.titre")}</h2>
          <div className="flex flex-wrap gap-2">
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && scannerManuel()}
              placeholder={t("entrepot.token_placeholder")}
              dir="ltr"
              className="min-w-60 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-xs focus:border-neutral-900 focus:outline-none"
            />
            <button
              onClick={scannerManuel}
              disabled={!token.trim()}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {t("scan.bouton")}
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-500">{t("entrepot.scan_aide")}</p>
        </section>

        {/* Compteurs */}
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-orange-200">
            <p className="text-xs uppercase tracking-wide text-neutral-400">
              {t("entrepot.attente_reception")}
            </p>
            <p className="mt-1 text-2xl font-bold" dir="ltr">
              {enAttenteReception}
            </p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-sky-200">
            <p className="text-xs uppercase tracking-wide text-neutral-400">
              {t("entrepot.attente_positionnement")}
            </p>
            <p className="mt-1 text-2xl font-bold" dir="ltr">
              {enAttentePositionnement}
            </p>
          </div>
        </section>

        {/* File des décharges scannées */}
        <section className="rounded-xl bg-white shadow-sm ring-1 ring-neutral-200">
          <div className="border-b border-neutral-100 px-5 py-3">
            <h2 className="text-sm font-semibold">{t("entrepot.file_titre")}</h2>
          </div>

          {!decharges && !erreur && (
            <p className="px-5 py-8 text-center text-sm text-neutral-500">{t("commun.chargement")}</p>
          )}

          {(decharges?.length ?? 0) === 0 && decharges && (
            <p className="px-5 py-8 text-center text-sm text-neutral-500">{t("entrepot.file_vide")}</p>
          )}

          <ul className="divide-y divide-neutral-100">
            {(decharges ?? []).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="space-y-0.5">
                  <Link
                    href={`/entrepot/decharges/${d.id}`}
                    className="font-semibold hover:underline"
                    dir="ltr"
                  >
                    {d.numero_decharge}
                  </Link>
                  <p className="text-xs text-neutral-500" dir="ltr">
                    {d.demande.reference} · {d.expediteur_nom} ·{" "}
                    {formaterDate(d.date_generation, locale)}
                  </p>
                </div>
                <EtapeBadge
                  evenements={d.evenements}
                  libelle={
                    d.evenements.includes("reception_confirmee")
                      ? t("entrepot.a_positionner")
                      : t("entrepot.a_recevoir")
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
