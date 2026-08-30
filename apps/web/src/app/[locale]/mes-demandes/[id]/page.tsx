"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { DemandeDetailDTO, ProduitDTO, UtilisateurDTO } from "@navex/contracts";
import {
  detailDemande, genererDecharge, planifierReception,
  telechargerDechargePdf, utilisateurCourant, validerProduit,
} from "@/lib/api-client";
import { formaterDate, messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { Bouton, classesBouton } from "@/components/bouton";

export default function PageDetailDemande() {
  const t = useTranslations();
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [demande, setDemande] = useState<DemandeDetailDTO | null>(null);
  const [utilisateur, setUtilisateur] = useState<UtilisateurDTO | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enCoursPdf, setEnCoursPdf] = useState(false);
  const [enCoursGeneration, setEnCoursGeneration] = useState(false);
  const [decisionsEnCours, setDecisionsEnCours] = useState<Record<string, boolean>>({});
  const [commentaires, setCommentaires] = useState<Record<string, string>>({});
  const [dateReception, setDateReception] = useState("");
  const [enCoursPlanif, setEnCoursPlanif] = useState(false);

  const charger = useCallback(() => {
    if (!id) return;
    detailDemande(id)
      .then((d) => { setDemande(d); setDateReception(d.date_reception_prevue ? d.date_reception_prevue.slice(0, 10) : ""); })
      .catch((e) => setErreur(messageErreur(t, e)));
  }, [id, t]);

  useEffect(() => { charger(); utilisateurCourant().then(setUtilisateur).catch(() => undefined); }, [charger]);

  const estAgent = utilisateur?.role === "agent_commercial" || utilisateur?.role === "admin";

  async function decider(produit: ProduitDTO, decision: "approuve" | "refuse") {
    if (!demande) return;
    setErreur(null); setSucces(null);
    setDecisionsEnCours((e) => ({ ...e, [produit.id]: true }));
    try {
      await validerProduit(demande.id, produit.id, { statut_validation: decision, commentaire: commentaires[produit.id]?.trim() || undefined });
      setSucces(t("validation.decision_enregistree"));
      charger();
    } catch (e) { setErreur(messageErreur(t, e)); }
    finally { setDecisionsEnCours((e) => ({ ...e, [produit.id]: false })); }
  }

  async function planifier() {
    if (!demande || !dateReception) return;
    setErreur(null); setSucces(null); setEnCoursPlanif(true);
    try {
      await planifierReception(demande.id, { date_reception_prevue: new Date(`${dateReception}T12:00:00Z`).toISOString() });
      setSucces(t("planification.enregistree")); charger();
    } catch (e) { setErreur(messageErreur(t, e)); }
    finally { setEnCoursPlanif(false); }
  }

  async function generer() {
    if (!demande) return;
    setErreur(null); setSucces(null); setEnCoursGeneration(true);
    try { await genererDecharge(demande.id); charger(); }
    catch (e) { setErreur(messageErreur(t, e)); }
    finally { setEnCoursGeneration(false); }
  }

  async function telechargerPdf() {
    if (!demande?.decharge) return;
    setErreur(null); setEnCoursPdf(true);
    try { await telechargerDechargePdf(demande.decharge.id, `${demande.decharge.numero_decharge}.pdf`); }
    catch (e) { setErreur(messageErreur(t, e)); }
    finally { setEnCoursPdf(false); }
  }

  if (erreur && !demande) return (
    <div className="min-h-dvh"><AppHeader /><main className="mx-auto max-w-3xl px-4 py-8">
      <p role="alert" className="rounded-2xl bg-navex-red-soft/80 px-4 py-2.5 text-sm text-navex-red-dark backdrop-blur-sm">{erreur}</p>
    </main></div>
  );

  if (!demande) return (
    <div className="min-h-dvh"><AppHeader /><main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-navex-red border-t-transparent"><span className="sr-only">{t("commun.chargement")}</span></div></div>
    </main></div>
  );

  const auMoinsUnApprouve = demande.produits.some((p) => p.statut_validation === "approuve");
  const produitsATraiter = estAgent ? demande.produits.filter((p) => p.statut_validation === "en_attente") : [];
  const volumeEstimeM3 = demande.produits.reduce((s, p) => s + (p.longueur_cm * p.largeur_cm * p.hauteur_cm * p.quantite) / 1_000_000, 0);
  function fmtVol(v: number) { return v === 0 ? "0" : v < 0.01 ? v.toExponential(1) : v < 1 ? v.toFixed(4) : v.toFixed(2); }

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-3 text-2xl font-extrabold text-navex-ink">
            <span dir="ltr">{t("demandes.detail_titre", { reference: demande.reference })}</span>
          </h1>
          <StatusBadge statut={demande.statut} />
        </div>

        {erreur && <p role="alert" className="rounded-2xl bg-navex-red-soft/80 px-4 py-2.5 text-sm text-navex-red-dark backdrop-blur-sm">{erreur}</p>}
        {succes && <p role="status" className="rounded-2xl bg-navex-stone/80 px-4 py-2.5 text-sm text-navex-ink backdrop-blur-sm">{succes}</p>}

        <section className="grid grid-cols-1 gap-4 rounded-3xl card-glass p-6 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-neutral-400">{t("demandes.expediteur_col")}</p>
            <p className="mt-1 font-medium text-navex-ink">{demande.expediteur.nom_entreprise}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-neutral-400">{t("demandes.date_creation")}</p>
            <p className="mt-1 text-navex-ink">{formaterDate(demande.date_creation, locale, true)}</p>
          </div>
          {demande.date_traitement && <div>
            <p className="text-xs uppercase text-neutral-400">{t("demandes.date_traitement")}</p>
            <p className="mt-1 text-navex-ink">{formaterDate(demande.date_traitement, locale, true)}</p>
          </div>}
          {demande.commentaire_agent && <div>
            <p className="text-xs uppercase text-neutral-400">{t("demandes.commentaire_agent")}</p>
            <p className="mt-1 text-navex-ink">{demande.commentaire_agent}</p>
          </div>}
          <div>
            <p className="text-xs uppercase text-neutral-400">{t("conditions_titre")}</p>
            <p className="mt-1 text-navex-ink">{demande.conditions_acceptee ? t("conditions_acceptee") : t("conditions_non_acceptee")}</p>
          </div>
        </section>

        {estAgent && (
          <section className="card-glass rounded-3xl p-6">
            <h2 className="mb-3 text-sm font-semibold text-navex-ink">{t("planification.titre")}</h2>
            <div className="flex flex-wrap items-center gap-3">
               <label htmlFor="date-reception" className="sr-only">{t("planification.titre")}</label>
                <input id="date-reception" type="date" value={dateReception} onChange={(e) => setDateReception(e.target.value)} dir="ltr"
                className="rounded-2xl border border-neutral-200/80 bg-white/60 px-3 py-2 text-sm shadow-soft focus:border-navex-red/40 focus:outline-none focus:ring-2 focus:ring-navex-red/10" />
              <Bouton onClick={planifier} disabled={!dateReception || enCoursPlanif} variante="secondaire">
                {enCoursPlanif ? t("commun.chargement") : t("planification.sauvegarder")}
              </Bouton>
              {demande.date_reception_prevue && (
                <span className="text-xs text-neutral-400">{t("planification.actuelle")} : {formaterDate(demande.date_reception_prevue, locale)}</span>
              )}
            </div>
          </section>
        )}

        <section className="space-y-3 rounded-3xl card-glass p-6">
          <h2 className="text-sm font-semibold text-navex-ink">{t("demandes.produits_titre")}</h2>
          <p className="text-xs text-neutral-500">{t("volume_estime")} : <span className="font-semibold text-navex-ink" dir="ltr">{fmtVol(volumeEstimeM3)} m³</span></p>
          {produitsATraiter.length > 0 && (
            <p className="rounded-2xl bg-navex-red-soft/80 px-4 py-2.5 text-xs font-medium text-navex-red-dark backdrop-blur-sm">
              {t("validation.produits_a_traiter", { nombre: produitsATraiter.length })}
            </p>
          )}
          {demande.produits.map((p) => {
            const aTraiter = produitsATraiter.some((x) => x.id === p.id);
            return (
              <article key={p.id} className={`space-y-3 rounded-2xl border p-4 ${aTraiter ? "border-navex-red/20 bg-navex-red-soft/30 backdrop-blur-sm" : "border-neutral-200/60"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {p.photo_url && (
                      <a href={p.photo_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <img src={p.photo_url} alt={p.designation} className="h-20 w-20 rounded-xl object-cover shadow-soft ring-1 ring-neutral-200/60 transition-transform hover:scale-105" />
                      </a>
                    )}
                    <div>
                      <p className="font-medium text-navex-ink"><span dir="ltr">{p.sku_code}</span> — {p.designation}{p.fragile && " ⚠"}</p>
                      <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500" dir={locale === "ar" ? "rtl" : "ltr"}>
                        <div className="flex gap-1"><dt className="text-neutral-400">{t("produit.dimensions_court")} :</dt><dd dir="ltr">{p.longueur_cm}×{p.largeur_cm}×{p.hauteur_cm}</dd></div>
                        <div className="flex gap-1"><dt className="text-neutral-400">{t("produit.poids")} :</dt><dd dir="ltr">{p.poids_kg}</dd></div>
                        <div className="flex gap-1"><dt className="text-neutral-400">{t("produit.quantite")} :</dt><dd dir="ltr">{p.quantite}</dd></div>
                        <div className="flex gap-1"><dt className="text-neutral-400">{t("produit.type_emballage")} :</dt><dd>{t(`produit.emballage_${p.type_emballage}`)}</dd></div>
                        {estAgent && ((p as any).volume_expedition_journalier != null || (p as any).volume_expedition_mensuel != null) && (
                          <>
                            {(p as any).volume_expedition_journalier != null && <div className="flex gap-1"><dt className="text-neutral-400">{t("volume_journalier")} :</dt><dd dir="ltr">{(p as any).volume_expedition_journalier}</dd></div>}
                            {(p as any).volume_expedition_mensuel != null && <div className="flex gap-1"><dt className="text-neutral-400">{t("volume_mensuel")} :</dt><dd dir="ltr">{(p as any).volume_expedition_mensuel}</dd></div>}
                          </>
                        )}
                      </dl>
                    </div>
                  </div>
                  <StatusBadge statut={p.statut_validation} />
                </div>
                {p.statut_validation !== "en_attente" && p.commentaire && (
                  <p className="rounded-xl bg-navex-stone/80 px-3 py-2 text-xs italic text-neutral-600 backdrop-blur-sm">« {p.commentaire} »</p>
                )}
                {aTraiter && (
                  <div className="space-y-3 border-t border-navex-red/10 pt-3">
                    <textarea value={commentaires[p.id] ?? ""} onChange={(e) => setCommentaires((c) => ({ ...c, [p.id]: e.target.value }))}
                      rows={2} maxLength={500} placeholder={t("validation.commentaire_placeholder")}
                      aria-label={t("validation.commentaire_placeholder")}
                      className="w-full rounded-2xl border border-neutral-200/80 bg-white/60 px-4 py-2.5 text-sm shadow-soft focus:border-navex-red/40 focus:outline-none focus:ring-2 focus:ring-navex-red/10" />
                    <div className="flex flex-wrap gap-2">
                      <button data-tour="demande-approve-btn" onClick={() => decider(p, "approuve")} disabled={!!decisionsEnCours[p.id]}
                        className={classesBouton("primaire", "bg-navex-ink hover:bg-navex-ink/80")}>
                        ✓ {t("validation.approuver")}
                      </button>
                      <Bouton onClick={() => decider(p, "refuse")} disabled={!!decisionsEnCours[p.id]} variante="primaire">
                        ✗ {t("validation.rejeter")}
                      </Bouton>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <section className="card-glass rounded-3xl p-6">
          <h2 className="mb-3 text-sm font-semibold text-navex-ink">{t("demandes.decharge_titre")}</h2>
          {demande.decharge ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-navex-ink" dir="ltr">{t("demandes.decharge_numero", { numero: demande.decharge.numero_decharge })}</p>
                <p className="mt-0.5 text-xs text-neutral-500"><StatusBadge statut={demande.decharge.statut} /></p>
              </div>
              <Bouton onClick={telechargerPdf} disabled={enCoursPdf} variante="primaire">
                {enCoursPdf ? t("demandes.generation_cours") : t("demandes.telecharger_pdf")}
              </Bouton>
            </div>
          ) : auMoinsUnApprouve ? (
            <div data-tour="demande-generate-decharge">
              <Bouton onClick={generer} disabled={enCoursGeneration} variante="primaire">
                {enCoursGeneration ? t("demandes.generation_cours") : t("demandes.generer_decharge")}
              </Bouton>
            </div>
          ) : (
            <p className="text-xs text-neutral-400">{t("erreurs.aucun_produit_approuve")}</p>
          )}
        </section>

        <div className="flex flex-wrap gap-3">
          <Bouton href={`/mes-demandes/${id}/historique`} variante="secondaire">
            🕐 {t("historique.titre")}
          </Bouton>
          <Bouton href="/mes-demandes" variante="secondaire">← {t("commun.retour")}</Bouton>
        </div>
      </main>
    </div>
  );
}
