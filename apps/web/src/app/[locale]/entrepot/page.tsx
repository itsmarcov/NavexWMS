"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { DechargeEntrepotListeDTO, ScanResultDTO } from "@navex/contracts";
import { listerDechargesEntrepot, scannerQr } from "@/lib/api-client";
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
  const [scanEnCours, setScanEnCours] = useState(false);

  /** Résultat du dernier scan douchette (succès ou erreur riche). */
  const [dernierScan, setDernierScan] = useState<
    | { kind: "ok"; resultat: ScanResultDTO }
    | { kind: "erreur"; message: string; dechargeId?: string }
    | null
  >(null);
  const champScan = useRef<HTMLInputElement>(null);

  const charger = useCallback(() => {
    listerDechargesEntrepot()
      .then(setDecharges)
      .catch((e) => setErreur(messageErreur(t, e)));
  }, [t]);

  useEffect(charger, [charger]);

  // Le poste de scan récupère le focus à l'ouverture et après chaque scan :
  // la douchette saisit comme un clavier, le champ doit toujours écouter.
  useEffect(() => {
    champScan.current?.focus();
  }, []);

  /**
   * La douchette envoie le contenu du QR tel quel : soit l'URL complète
   * encodée dans le PDF (…/fr/scan?t=<jwt>), soit un jeton brut.
   */
  function extraireJeton(saisie: string) {
    const texte = saisie.trim();
    const correspondance = texte.match(/[?&]t=([^&\s]+)/);
    if (correspondance) return decodeURIComponent(correspondance[1]);
    return texte;
  }

  async function traiterScan() {
    const jeton = extraireJeton(token);
    setToken("");
    if (!jeton || scanEnCours) {
      champScan.current?.focus();
      return;
    }
    setErreur(null);
    setDernierScan(null);
    setScanEnCours(true);
    try {
      const resultat = await scannerQr(jeton);
      setDernierScan({ kind: "ok", resultat });
      charger();
    } catch (e) {
      setDernierScan({
        kind: "erreur",
        message:
          e.code && e.code.startsWith("erreurs.") ? t(e.code) : messageErreur(t, e),
        dechargeId:
          (e.donnees?.decharge_id as string | undefined) ?? (e.decharge_id as string | undefined),
      });
    } finally {
      setScanEnCours(false);
      champScan.current?.focus();
    }
  }

  const enAttenteReception =
    decharges?.filter((d) => !d.evenements.includes("reception_confirmee")).length ?? 0;
  const enAttentePositionnement =
    decharges?.filter(
      (d) => d.evenements.includes("reception_confirmee") && !d.evenements.includes("repositionnement"),
    ).length ?? 0;

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

        {/* Poste de scan : douchette (saisie clavier + Entrée) ou collage manuel */}
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-3 text-sm font-semibold">{t("scan.titre")}</h2>
          <div className="flex flex-wrap gap-2">
            <input
              ref={champScan}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && traiterScan()}
              placeholder={t("entrepot.token_placeholder")}
              dir="ltr"
              autoComplete="off"
              className="min-w-60 flex-1 rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs focus:border-neutral-900 focus:outline-none"
            />
            <button
              onClick={traiterScan}
              disabled={scanEnCours}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {scanEnCours ? t("commun.chargement") : t("scan.bouton")}
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-500">{t("entrepot.scan_aide_douchette")}</p>

          {/* Résultat du dernier scan, sans quitter le poste */}
          {dernierScan?.kind === "ok" && (
            <div className="mt-4 space-y-2 rounded-lg bg-green-50 p-4 ring-1 ring-green-200">
              <p className="flex items-center gap-2 text-sm font-semibold text-green-800">
                ✓ {t("scan.arrivee_confirmee")}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-green-900">
                <span dir="ltr">
                  {dernierScan.resultat.numero_decharge} · {dernierScan.resultat.demande_reference} ·{" "}
                  {dernierScan.resultat.expediteur_nom} · {dernierScan.resultat.nb_produits}{" "}
                  {t("file_attente.produits_approuves").toLowerCase()}
                </span>
                <Link
                  href={`/entrepot/decharges/${dernierScan.resultat.decharge_id}`}
                  className="font-semibold underline hover:text-green-700"
                >
                  {t("entrepot.traiter_decharge")}
                </Link>
              </div>
            </div>
          )}

          {dernierScan?.kind === "erreur" && (
            <div className="mt-4 rounded-lg bg-red-50 p-4 ring-1 ring-red-200">
              <p role="alert" className="text-sm font-medium text-red-700">
                ✗ {dernierScan.message}
              </p>
              {dernierScan.dechargeId && (
                <Link
                  href={`/entrepot/decharges/${dernierScan.dechargeId}`}
                  className="mt-1 inline-block text-xs font-semibold text-red-800 underline hover:text-red-600"
                >
                  {t("entrepot.traiter_decharge")}
                </Link>
              )}
            </div>
          )}
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
