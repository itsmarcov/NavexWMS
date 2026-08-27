"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ScanResultDTO } from "@navex/contracts";
import { scannerQr } from "@/lib/api-client";
import { messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";
import { Bouton } from "@/components/bouton";

type Etat = { kind: "chargement" } | { kind: "ok"; resultat: ScanResultDTO } | { kind: "erreur"; code?: string };

export default function PageScan() {
  const t = useTranslations();
  const [etat, setEtat] = useState<Etat>({ kind: "chargement" });
  const lance = useRef(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("t") ?? "";
    if (lance.current) return;
    lance.current = true;
    if (!token) { setEtat({ kind: "erreur", code: "erreurs.qr_invalide" }); return; }
    scannerQr(token)
      .then((resultat) => setEtat({ kind: "ok", resultat }))
      .catch((e) => setEtat({ kind: "erreur", code: e.code }));
  }, []);

  return (
    <div className="min-h-dvh bg-ambient">
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 py-10 space-y-6">
        <h1 className="text-2xl font-extrabold text-navex-ink">{t("scan.titre")}</h1>

        {etat.kind === "chargement" && (
          <div className="card-glass rounded-3xl p-8 text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-navex-red border-t-transparent" role="status">
              <span className="sr-only">{t("commun.chargement")}</span>
            </div>
            <p className="text-sm text-neutral-500">{t("commun.chargement")}</p>
          </div>
        )}

        {etat.kind === "erreur" && (
          <div className="card-glass rounded-3xl p-8 text-center ring-1 ring-navex-red/20 animate-slide-up">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-navex-red text-2xl text-white shadow-glow-red">✗</div>
            <p role="alert" className="rounded-2xl bg-navex-red-soft/80 px-4 py-2.5 text-sm font-medium text-navex-red-dark backdrop-blur-sm">
              {etat.code?.startsWith("erreurs.") ? t(etat.code) : messageErreur(t, new Error("generique"))}
            </p>
            <Bouton href="/entrepot" variante="secondaire" className="mt-4">
              {t("entrepot.retour_tableau")}
            </Bouton>
          </div>
        )}

        {etat.kind === "ok" && (
          <div className="card-glass rounded-3xl p-8 space-y-5 ring-1 ring-navex-red/20 animate-slide-up">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-navex-red text-xl text-white shadow-glow-red" aria-hidden>✓</span>
              <p className="font-bold text-navex-ink">{t("scan.arrivee_confirmee")}</p>
            </div>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><dt className="text-xs uppercase text-neutral-400">{t("demandes.decharge_col")}</dt><dd className="mt-0.5 font-medium text-navex-ink" dir="ltr">{etat.resultat.numero_decharge}</dd></div>
              <div><dt className="text-xs uppercase text-neutral-400">{t("demandes.reference")}</dt><dd className="mt-0.5 font-medium text-navex-ink" dir="ltr">{etat.resultat.demande_reference}</dd></div>
              <div><dt className="text-xs uppercase text-neutral-400">{t("demandes.expediteur_col")}</dt><dd className="mt-0.5 text-navex-ink">{etat.resultat.expediteur_nom}</dd></div>
              <div><dt className="text-xs uppercase text-neutral-400">{t("file_attente.produits_approuves")}</dt><dd className="mt-0.5 text-navex-ink" dir="ltr">{etat.resultat.nb_produits}</dd></div>
            </dl>
            <Bouton href={`/entrepot/decharges/${etat.resultat.decharge_id}`} variante="primaire" className="block text-center">
              {t("entrepot.traiter_decharge")}
            </Bouton>
          </div>
        )}
      </main>
    </div>
  );
}
