"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { DechargeEntrepotListeDTO, ScanResultDTO } from "@navex/contracts";
import { ApiError, listerDechargesEntrepot, scannerQr } from "@/lib/api-client";
import { formaterDate, messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";
import { RequireRole } from "@/components/require-role";
import { Bouton, classesBouton } from "@/components/bouton";

function EtapeBadge({ evenements, libelle }: { evenements: string[]; libelle: string }) {
  if (!evenements.includes("reception_confirmee")) {
    return <span className="rounded-full bg-navex-red-soft/80 px-2.5 py-1 text-xs font-medium text-navex-red-dark backdrop-blur-sm">{libelle}</span>;
  }
  return <span className="rounded-full bg-navex-ink px-2.5 py-1 text-xs font-medium text-white">{libelle}</span>;
}

export default function PageEntrepot() {
  const t = useTranslations();
  const locale = useLocale();
  const [decharges, setDecharges] = useState<DechargeEntrepotListeDTO[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [scanEnCours, setScanEnCours] = useState(false);
  const [dernierScan, setDernierScan] = useState<
    { kind: "ok"; resultat: ScanResultDTO } | { kind: "erreur"; message: string; dechargeId?: string } | null
  >(null);
  const champScan = useRef<HTMLInputElement>(null);

  const charger = useCallback(() => {
    listerDechargesEntrepot().then(setDecharges).catch((e) => setErreur(messageErreur(t, e)));
  }, [t]);

  useEffect(charger, [charger]);
  useEffect(() => { champScan.current?.focus(); }, []);

  function extraireJeton(saisie: string) {
    const texte = saisie.trim();
    const correspondance = texte.match(/[?&]t=([^&\s]+)/);
    if (correspondance?.[1]) return decodeURIComponent(correspondance[1]);
    return texte;
  }

  async function traiterScan() {
    const jeton = extraireJeton(token);
    setToken("");
    if (!jeton || scanEnCours) { champScan.current?.focus(); return; }
    setErreur(null); setDernierScan(null); setScanEnCours(true);
    try {
      const resultat = await scannerQr(jeton);
      setDernierScan({ kind: "ok", resultat }); charger();
    } catch (e) {
      const erreurApi = e as ApiError;
      setDernierScan({ kind: "erreur", message: erreurApi.code?.startsWith("erreurs.") ? t(erreurApi.code) : messageErreur(t, e), dechargeId: erreurApi.donnees?.decharge_id as string | undefined });
    } finally { setScanEnCours(false); champScan.current?.focus(); }
  }

  const enAttenteReception = decharges?.filter((d) => !d.evenements.includes("reception_confirmee")).length ?? 0;
  const enAttentePositionnement = decharges?.filter((d) => d.evenements.includes("reception_confirmee") && !d.evenements.includes("repositionnement")).length ?? 0;

  return (
    <RequireRole roles={["agent_entrepot", "admin"]}>
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <h1 className="text-2xl font-extrabold text-navex-ink">{t("entrepot.titre")}</h1>

        {erreur && <p role="alert" className="rounded-2xl bg-navex-red-soft/80 px-4 py-2.5 text-sm text-navex-red-dark backdrop-blur-sm">{erreur}</p>}

        {/* Poste de scan douchette */}
        <section className="rounded-3xl border-2 border-navex-red/40 bg-navex-ink/95 p-6 shadow-glass-lg backdrop-blur-sm">
          <h2 className="mb-3 text-sm font-semibold text-white">{t("scan.titre")}</h2>
          <div className="flex flex-wrap gap-2">
            <input ref={champScan} value={token} onChange={(e) => setToken(e.target.value)} onKeyDown={(e) => e.key === "Enter" && traiterScan()}
              placeholder={t("entrepot.token_placeholder")} dir="ltr" autoComplete="off"
              className="min-w-60 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-xs text-white placeholder:text-neutral-500 focus:border-navex-red/60 focus:outline-none focus:ring-2 focus:ring-navex-red/20" />
            <Bouton variante="primaire" onClick={traiterScan} disabled={scanEnCours}
              className={classesBouton("primaire", "bg-gradient-to-r from-navex-red to-navex-red-dark px-6 py-3 shadow-glow-red hover:opacity-90")}>
              {scanEnCours ? t("commun.chargement") : t("scan.bouton")}
            </Bouton>
          </div>
          <p className="mt-2 text-xs text-neutral-400">{t("entrepot.scan_aide_douchette")}</p>

          {dernierScan?.kind === "ok" && (
            <div className="mt-4 space-y-2 rounded-2xl bg-navex-red-soft/90 p-4 ring-1 ring-navex-red/20 backdrop-blur-sm">
              <p className="flex items-center gap-2 text-sm font-semibold text-navex-red-dark">✓ {t("scan.arrivee_confirmee")}</p>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-navex-ink">
                <span dir="ltr">{dernierScan.resultat.numero_decharge} · {dernierScan.resultat.demande_reference} · {dernierScan.resultat.expediteur_nom} · {dernierScan.resultat.nb_produits} {t("file_attente.produits_approuves").toLowerCase()}</span>
                <Link href={`/entrepot/decharges/${dernierScan.resultat.decharge_id}`} className="font-semibold text-navex-red underline hover:text-navex-red-dark">{t("entrepot.traiter_decharge")}</Link>
              </div>
            </div>
          )}
          {dernierScan?.kind === "erreur" && (
            <div className="mt-4 rounded-2xl bg-navex-red/10 p-4 ring-1 ring-navex-red/20 backdrop-blur-sm">
              <p role="alert" className="text-sm font-medium text-navex-red">✗ {dernierScan.message}</p>
              {dernierScan.dechargeId && (
                <Link href={`/entrepot/decharges/${dernierScan.dechargeId}`} className="mt-1 inline-block text-xs font-semibold text-navex-red underline hover:text-navex-red-dark">{t("entrepot.traiter_decharge")}</Link>
              )}
            </div>
          )}
        </section>

        <section className="grid grid-cols-2 gap-4">
          <div className="card-glass rounded-3xl p-6 ring-glow animate-slide-up">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">{t("entrepot.attente_reception")}</p>
            <p className="mt-2 text-4xl font-extrabold text-navex-red" dir="ltr">{enAttenteReception}</p>
          </div>
          <div className="card-glass rounded-3xl p-6 animate-slide-up">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">{t("entrepot.attente_positionnement")}</p>
            <p className="mt-2 text-4xl font-extrabold text-navex-ink" dir="ltr">{enAttentePositionnement}</p>
          </div>
        </section>

        <section className="card-glass-solid rounded-3xl">
          <div className="border-b border-neutral-100/60 px-6 py-4">
            <h2 className="text-sm font-semibold text-navex-ink">{t("entrepot.file_titre")}</h2>
          </div>
          {!decharges && !erreur && <p className="px-6 py-10 text-center text-sm text-neutral-500">{t("commun.chargement")}</p>}
          {(decharges?.length ?? 0) === 0 && decharges && <p className="px-6 py-10 text-center text-sm text-neutral-500">{t("entrepot.file_vide")}</p>}
          <ul className="divide-y divide-neutral-100/60">
            {(decharges ?? []).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-white/40">
                <div className="space-y-0.5">
                  <Link href={`/entrepot/decharges/${d.id}`} className="font-semibold text-navex-ink hover:underline" dir="ltr">{d.numero_decharge}</Link>
                  <p className="text-xs text-neutral-400" dir="ltr">{d.demande.reference} · {d.expediteur_nom} · {formaterDate(d.date_generation, locale)}</p>
                </div>
                <EtapeBadge evenements={d.evenements} libelle={d.evenements.includes("reception_confirmee") ? t("entrepot.a_positionner") : t("entrepot.a_recevoir")} />
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
    </RequireRole>
  );
}
