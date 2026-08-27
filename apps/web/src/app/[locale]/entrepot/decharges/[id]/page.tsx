"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { DechargeEntrepotDetailDTO, EmplacementDTO } from "@navex/contracts";
import { confirmerReceptionEntrepot, detailDechargeEntrepot, listerEmplacements, positionnerDecharge } from "@/lib/api-client";
import { formaterDate, messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { RequireRole } from "@/components/require-role";
import { Bouton } from "@/components/bouton";

export default function PageDechargeEntrepot() {
  const t = useTranslations();
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [decharge, setDecharge] = useState<DechargeEntrepotDetailDTO | null>(null);
  const [emplacements, setEmplacements] = useState<EmplacementDTO[]>([]);
  const [emplacementChoisi, setEmplacementChoisi] = useState("");
  const [notesReception, setNotesReception] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(() => {
    if (!id) return;
    detailDechargeEntrepot(id).then(setDecharge).catch((e) => setErreur(messageErreur(t, e)));
  }, [id, t]);

  useEffect(charger, [charger]);

  const recue = decharge?.mouvements.some((m) => m.type_evenement === "reception_confirmee") ?? false;
  const positionnee = decharge?.mouvements.some((m) => m.type_evenement === "repositionnement") ?? false;

  useEffect(() => { if (recue && !positionnee) listerEmplacements(true).then(setEmplacements).catch(() => undefined); }, [recue, positionnee]);

  async function confirmerReception() {
    if (!decharge) return;
    setErreur(null); setSucces(null); setEnCours(true);
    try { await confirmerReceptionEntrepot(decharge.id, notesReception.trim() || undefined); setSucces(t("entrepot.reception_confirmee")); charger(); }
    catch (e) { setErreur(messageErreur(t, e)); }
    finally { setEnCours(false); }
  }

  async function positionner() {
    if (!decharge || !emplacementChoisi) return;
    setErreur(null); setSucces(null); setEnCours(true);
    try { await positionnerDecharge(decharge.id, emplacementChoisi); setSucces(t("entrepot.positionnement_confirme")); charger(); }
    catch (e) { setErreur(messageErreur(t, e)); }
    finally { setEnCours(false); }
  }

  function libelleEmplacement(e: EmplacementDTO) { return `${e.zone}-${e.allee}-${e.rack}-${e.niveau}`; }

  return (
    <RequireRole roles={["agent_entrepot", "admin"]}>
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        {!decharge && !erreur && <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-navex-red border-t-transparent" /></div>}
        {erreur && <p role="alert" className="rounded-2xl bg-navex-red-soft/80 px-4 py-2.5 text-sm text-navex-red-dark backdrop-blur-sm">{erreur}</p>}
        {succes && <p role="status" className="rounded-2xl bg-navex-stone/80 px-4 py-2.5 text-sm text-navex-ink backdrop-blur-sm">{succes}</p>}

        {decharge && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-extrabold text-navex-ink" dir="ltr">{t("demandes.decharge_numero", { numero: decharge.numero_decharge })}</h1>
              <StatusBadge statut={decharge.statut} />
            </div>

            <section className="grid grid-cols-1 gap-4 rounded-3xl bg-white/70 p-6 shadow-soft backdrop-blur-xl ring-1 ring-white/50 sm:grid-cols-3">
              <div><p className="text-xs uppercase text-neutral-400">{t("demandes.reference")}</p><p className="mt-1 font-medium text-navex-ink" dir="ltr">{decharge.demande.reference}</p></div>
              <div><p className="text-xs uppercase text-neutral-400">{t("demandes.expediteur_col")}</p><p className="mt-1 font-medium text-navex-ink">{decharge.expediteur_nom}</p></div>
              <div><p className="text-xs uppercase text-neutral-400">{t("file_attente.produits_approuves")}</p><p className="mt-1 font-medium text-navex-ink" dir="ltr">{decharge.produits.length}</p></div>
            </section>

            <section className="overflow-x-auto card-glass-solid rounded-3xl p-6">
              <h2 className="mb-3 text-sm font-semibold text-navex-ink">{t("entrepot.marchandise_recue")}</h2>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-neutral-200/60 text-xs uppercase text-neutral-400">
                  <th className="py-2 text-start">{t("produit.sku")}</th><th className="py-2 text-start">{t("produit.designation")}</th><th className="py-2 text-end">{t("produit.dimensions_court")}</th><th className="py-2 text-end">{t("produit.quantite")}</th>
                </tr></thead>
                <tbody>
                  {decharge.produits.map((p) => (
                    <tr key={p.id} className="border-b border-neutral-100/60">
                      <td className="py-2 text-navex-ink" dir="ltr">{p.sku_code}</td>
                      <td className="py-2 text-navex-ink">{p.designation} {p.fragile && "⚠"}</td>
                      <td className="py-2 text-end text-navex-ink" dir="ltr">{p.longueur_cm}×{p.largeur_cm}×{p.hauteur_cm}</td>
                      <td className="py-2 text-end text-navex-ink" dir="ltr">{p.quantite}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="space-y-4 rounded-3xl bg-white/70 p-6 shadow-soft backdrop-blur-xl ring-1 ring-white/50">
              <h2 className="text-sm font-semibold text-navex-ink">{t("entrepot.actions_titre")}</h2>
              {!recue && (
                <div className="space-y-3">
                  <textarea value={notesReception} onChange={(e) => setNotesReception(e.target.value)} rows={2} maxLength={500} placeholder={t("entrepot.notes_placeholder")}
                    className="w-full rounded-2xl border border-neutral-200/80 bg-white/60 px-4 py-2.5 text-sm shadow-soft focus:border-navex-red/40 focus:outline-none focus:ring-2 focus:ring-navex-red/10" />
                  <Bouton variante="primaire" onClick={confirmerReception} disabled={enCours || decharge.statut !== "scannee"}>
                    ✓ {t("entrepot.confirmer_reception")}
                  </Bouton>
                </div>
              )}
              {recue && !positionnee && (
                <div className="flex flex-wrap items-center gap-3">
                  <select value={emplacementChoisi} onChange={(e) => setEmplacementChoisi(e.target.value)} aria-label={t("entrepot.choisir_emplacement")}
                    className="rounded-2xl border border-neutral-200/80 bg-white/60 px-3 py-2 text-sm shadow-soft focus:border-navex-red/40 focus:outline-none focus:ring-2 focus:ring-navex-red/10">
                    <option value="">{t("entrepot.choisir_emplacement")}</option>
                    {Object.entries(emplacements.reduce<Record<string, EmplacementDTO[]>>((g, e) => { (g[e.zone] ??= []).push(e); return g; }, {}))
                      .map(([zone, liste]) => (
                        <optgroup key={zone} label={zone}>
                          {liste.map((e) => <option key={e.id} value={e.id}>{libelleEmplacement(e)} ({t("entrepot.capacite")} {e.capacite_max})</option>)}
                        </optgroup>
                      ))}
                  </select>
                  <Bouton variante="primaire" onClick={positionner} disabled={!emplacementChoisi || enCours}>
                    📍 {t("entrepot.positionner")}
                  </Bouton>
                  {emplacements.length === 0 && <span className="text-xs font-medium text-navex-red">{t("erreurs.aucun_emplacement_libre")}</span>}
                </div>
              )}
              {recue && positionnee && (
                <p className="rounded-2xl bg-navex-stone/80 px-4 py-2.5 text-sm font-medium text-navex-ink backdrop-blur-sm">{t("entrepot.terminee")}</p>
              )}
            </section>

            <section className="card-glass-solid rounded-3xl p-6">
              <h2 className="mb-4 text-sm font-semibold text-navex-ink">{t("entrepot.timeline_titre")}</h2>
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
                {decharge.mouvements.length === 0 && <li className="text-xs text-neutral-400">{t("entrepot.aucun_mouvement")}</li>}
              </ol>
            </section>

            <Bouton variante="secondaire" href="/entrepot">
              ← {t("commun.retour")}
            </Bouton>
          </>
        )}
      </main>
    </div>
    </RequireRole>
  );
}
