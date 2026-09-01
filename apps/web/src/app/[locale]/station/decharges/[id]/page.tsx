"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { DechargeStationDetailDTO, ProduitStationDTO, EtiquetteDTO, ModifierProduitStationPayload, TypeEmballageDTO } from "@navex/contracts";
import { TYPES_EMBALLAGE } from "@navex/contracts";
import {
  detailDechargeStation,
  modifierProduitStation,
  genererDechargeTransit,
  preparerEtiquettes,
} from "@/lib/api-client";
import { formaterDate, messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { RequireRole } from "@/components/require-role";
import { Bouton } from "@/components/bouton";

type ProduitEditable = ProduitStationDTO & { enCoursSauvegarde: boolean };

export default function PageDechargeStation() {
  const t = useTranslations();
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [decharge, setDecharge] = useState<DechargeStationDetailDTO | null>(null);
  const [produits, setProduits] = useState<ProduitEditable[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const [transitResult, setTransitResult] = useState<{ numero_decharge: string; qr_code: string } | null>(null);
  const [etiquettes, setEtiquettes] = useState<EtiquetteDTO[]>([]);

  const charger = useCallback(() => {
    if (!id) return;
    detailDechargeStation(id)
      .then((d) => {
        setDecharge(d);
        setProduits(d.produits.map((p) => ({ ...p, enCoursSauvegarde: false })));
      })
      .catch((e) => setErreur(messageErreur(t, e)));
  }, [id, t]);

  useEffect(charger, [charger]);

  async function sauvegarderProduit(produitId: string) {
    if (!decharge) return;
    const p = produits.find((x) => x.id === produitId);
    if (!p) return;

    setProduits((prev) => prev.map((x) => (x.id === produitId ? { ...x, enCoursSauvegarde: true } : x)));
    try {
      const dto: ModifierProduitStationPayload = {
        designation: p.designation,
        quantite: p.quantite,
        longueur_cm: p.longueur_cm,
        largeur_cm: p.largeur_cm,
        hauteur_cm: p.hauteur_cm,
        poids_kg: p.poids_kg,
        fragile: p.fragile,
        type_emballage: p.type_emballage,
      };
      await modifierProduitStation(decharge.id, produitId, dto);
      setSucces(t("station.produit_modifie"));
    } catch (e) {
      setErreur(messageErreur(t, e));
    } finally {
      setProduits((prev) => prev.map((x) => (x.id === produitId ? { ...x, enCoursSauvegarde: false } : x)));
    }
  }

  function majProduit(produitId: string, champ: keyof ProduitEditable, valeur: string | number | boolean) {
    setProduits((prev) => prev.map((x) => (x.id === produitId ? { ...x, [champ]: valeur } : x)));
  }

  async function genererTransit() {
    if (!decharge) return;
    setErreur(null); setSucces(null); setEnCours(true);
    try {
      const result = await genererDechargeTransit(decharge.id);
      setTransitResult({ numero_decharge: result.numero_decharge, qr_code: result.qr_code });
      setSucces(t("station.decharge_transit_generee"));
      charger();
    } catch (e) {
      setErreur(messageErreur(t, e));
    } finally {
      setEnCours(false);
    }
  }

  async function preparerLabels() {
    if (!decharge) return;
    setErreur(null); setSucces(null); setEnCours(true);
    try {
      const result = await preparerEtiquettes(decharge.id);
      setEtiquettes(result);
      setSucces(t("station.etiquettes_preparees"));
    } catch (e) {
      setErreur(messageErreur(t, e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <RequireRole roles={["agent_station", "admin"]}>
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {!decharge && !erreur && <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-navex-red border-t-transparent"><span className="sr-only">{t("commun.chargement")}</span></div></div>}
        {erreur && <p role="alert" className="rounded-2xl bg-navex-red-soft/80 px-4 py-2.5 text-sm text-navex-red-dark backdrop-blur-sm">{erreur}</p>}
        {succes && <p role="status" className="rounded-2xl bg-navex-stone/80 px-4 py-2.5 text-sm text-navex-ink backdrop-blur-sm">{succes}</p>}

        {decharge && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 animate-slide-up">
              <h1 className="text-2xl font-extrabold text-navex-ink" dir="ltr">{t("demandes.decharge_numero", { numero: decharge.numero_decharge })}</h1>
              <StatusBadge statut={decharge.statut} />
            </div>

            <section className="grid grid-cols-1 gap-4 rounded-3xl card-glass p-6 sm:grid-cols-2 lg:grid-cols-4 animate-slide-up">
              <div><p className="text-xs uppercase text-neutral-400">{t("demandes.reference")}</p><p className="mt-1 font-medium text-navex-ink" dir="ltr">{decharge.demande.reference}</p></div>
              <div><p className="text-xs uppercase text-neutral-400">{t("demandes.expediteur_col")}</p><p className="mt-1 font-medium text-navex-ink">{decharge.expediteur_nom}</p></div>
              {decharge.station_nom && <div><p className="text-xs uppercase text-neutral-400">{t("station.station")}</p><p className="mt-1 font-medium text-navex-ink">{decharge.station_nom}</p></div>}
              {decharge.parent_decharge && <div><p className="text-xs uppercase text-neutral-400">{t("station.decharge_parente")}</p><p className="mt-1 font-medium text-navex-ink" dir="ltr">{decharge.parent_decharge.numero_decharge}</p></div>}
            </section>

            <section className="overflow-x-auto card-glass-solid rounded-3xl p-6 animate-slide-up">
              <h2 className="mb-3 text-sm font-semibold text-navex-ink">{t("station.produits_modifiables")}</h2>
              <div className="space-y-4">
                {produits.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-neutral-200/60 bg-white/40 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xs font-mono text-neutral-500" dir="ltr">{p.sku_code}</span>
                      {p.fragile && <span className="text-xs text-amber-500">⚠</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                      <div className="col-span-2 lg:col-span-2">
                        <label className="text-xs uppercase text-neutral-400">{t("produit.designation")}</label>
                        <input type="text" value={p.designation} onChange={(e) => majProduit(p.id, "designation", e.target.value)}
                          className="mt-1 w-full rounded-xl border border-neutral-200/80 bg-white/60 px-3 py-1.5 text-sm shadow-soft focus:border-navex-red/40 focus:outline-none focus:ring-2 focus:ring-navex-red/10" />
                      </div>
                      <div>
                        <label className="text-xs uppercase text-neutral-400">{t("produit.quantite")}</label>
                        <input type="number" min={1} value={p.quantite} onChange={(e) => majProduit(p.id, "quantite", Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-neutral-200/80 bg-white/60 px-3 py-1.5 text-sm shadow-soft focus:border-navex-red/40 focus:outline-none focus:ring-2 focus:ring-navex-red/10" />
                      </div>
                      <div>
                        <label className="text-xs uppercase text-neutral-400">{t("produit.longueur")}</label>
                        <input type="number" min={0} value={p.longueur_cm} onChange={(e) => majProduit(p.id, "longueur_cm", Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-neutral-200/80 bg-white/60 px-3 py-1.5 text-sm shadow-soft focus:border-navex-red/40 focus:outline-none focus:ring-2 focus:ring-navex-red/10" />
                      </div>
                      <div>
                        <label className="text-xs uppercase text-neutral-400">{t("produit.largeur")}</label>
                        <input type="number" min={0} value={p.largeur_cm} onChange={(e) => majProduit(p.id, "largeur_cm", Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-neutral-200/80 bg-white/60 px-3 py-1.5 text-sm shadow-soft focus:border-navex-red/40 focus:outline-none focus:ring-2 focus:ring-navex-red/10" />
                      </div>
                      <div>
                        <label className="text-xs uppercase text-neutral-400">{t("produit.hauteur")}</label>
                        <input type="number" min={0} value={p.hauteur_cm} onChange={(e) => majProduit(p.id, "hauteur_cm", Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-neutral-200/80 bg-white/60 px-3 py-1.5 text-sm shadow-soft focus:border-navex-red/40 focus:outline-none focus:ring-2 focus:ring-navex-red/10" />
                      </div>
                      <div>
                        <label className="text-xs uppercase text-neutral-400">{t("produit.poids")}</label>
                        <input type="number" min={0} step={0.1} value={p.poids_kg} onChange={(e) => majProduit(p.id, "poids_kg", Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-neutral-200/80 bg-white/60 px-3 py-1.5 text-sm shadow-soft focus:border-navex-red/40 focus:outline-none focus:ring-2 focus:ring-navex-red/10" />
                      </div>
                      <div>
                        <label className="text-xs uppercase text-neutral-400">{t("produit.emballage")}</label>
                        <select value={p.type_emballage} onChange={(e) => majProduit(p.id, "type_emballage", e.target.value as TypeEmballageDTO)}
                          className="mt-1 w-full rounded-xl border border-neutral-200/80 bg-white/60 px-3 py-1.5 text-sm shadow-soft focus:border-navex-red/40 focus:outline-none focus:ring-2 focus:ring-navex-red/10">
                          {TYPES_EMBALLAGE.map((te) => <option key={te} value={te}>{te}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={p.fragile} onChange={(e) => majProduit(p.id, "fragile", e.target.checked)}
                          className="h-4 w-4 rounded border-neutral-300 text-navex-red focus:ring-navex-red/20" />
                        {t("produit.fragile")}
                      </label>
                      <Bouton variante="primaire" onClick={() => sauvegarderProduit(p.id)} disabled={p.enCoursSauvegarde}>
                        {p.enCoursSauvegarde ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
                        {" "}{t("commun.sauvegarder")}
                      </Bouton>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4 rounded-3xl card-glass p-6 animate-slide-up">
              <h2 className="text-sm font-semibold text-navex-ink">{t("station.actions_transit")}</h2>
              <div className="flex flex-wrap gap-3">
                {!transitResult && (
                  <Bouton variante="primaire" onClick={genererTransit} disabled={enCours}>
                    {enCours ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
                    {" "}{t("station.generer_decharge_transit")}
                  </Bouton>
                )}
                <Bouton variante="secondaire" onClick={preparerLabels} disabled={enCours}>
                  {t("station.imprimer_etiquettes")}
                </Bouton>
              </div>

              {transitResult && (
                <div className="rounded-2xl border border-navex-stone bg-white/60 p-4">
                  <p className="text-sm font-medium text-navex-ink">{t("station.decharge_transit_creee")} <span dir="ltr" className="font-mono">{transitResult.numero_decharge}</span></p>
                  {transitResult.qr_code && (
                    <div className="mt-3">
                      <img src={transitResult.qr_code} alt="QR Code" className="h-32 w-32" />
                    </div>
                  )}
                </div>
              )}

              {etiquettes.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {etiquettes.map((et) => (
                    <div key={et.id} className="rounded-2xl border border-neutral-200/60 bg-white/40 p-4">
                      <p className="text-xs text-neutral-400">{t("station.sac")} {et.sac_numero}/{et.sac_total}</p>
                      <p className="mt-1 font-mono text-sm text-navex-ink" dir="ltr">{et.sku_code}</p>
                      <p className="text-sm text-navex-ink">{et.designation}</p>
                      <p className="mt-1 text-xs text-neutral-400" dir="ltr">{et.decharge_numero}</p>
                      <p className="text-xs text-neutral-400" dir="ltr">{et.demande_reference}</p>
                      <p className="text-xs text-neutral-400">{et.station_nom}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card-glass-solid rounded-3xl p-6 animate-slide-up">
              <h2 className="mb-4 text-sm font-semibold text-navex-ink">{t("station.timeline_titre")}</h2>
              <ol className="space-y-4">
                {decharge.mouvements.map((m) => (
                  <li key={m.id} className="flex gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-navex-red" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-navex-ink">
                        {t(`evenements.${m.type_evenement}`)}
                        {m.emplacement && <span className="ms-2 rounded-lg bg-navex-stone/80 px-1.5 py-0.5 font-mono text-xs text-navex-ink backdrop-blur-sm" dir="ltr">{m.emplacement.zone}-{m.emplacement.allee}-{m.emplacement.rack}-{m.emplacement.niveau}</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-400" dir={locale === "ar" ? "rtl" : "ltr"}>{formaterDate(m.date_evenement, locale, true)} · {m.agent_email}</p>
                      {m.notes && <p className="mt-1 text-xs italic text-neutral-500">« {m.notes} »</p>}
                    </div>
                  </li>
                ))}
                {decharge.mouvements.length === 0 && <li className="text-xs text-neutral-400">{t("station.aucun_mouvement")}</li>}
              </ol>
            </section>

            <Bouton variante="secondaire" href="/station">
              ← {t("commun.retour")}
            </Bouton>
          </>
        )}
      </main>
    </div>
    </RequireRole>
  );
}
