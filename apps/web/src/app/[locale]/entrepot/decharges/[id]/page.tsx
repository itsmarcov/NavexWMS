"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { DechargeEntrepotDetailDTO, EmplacementDTO } from "@navex/contracts";
import {
  confirmerReceptionEntrepot,
  detailDechargeEntrepot,
  listerEmplacements,
  positionnerDecharge,
} from "@/lib/api-client";
import { formaterDate, messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";

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
    detailDechargeEntrepot(id)
      .then(setDecharge)
      .catch((e) => setErreur(messageErreur(t, e)));
  }, [id, t]);

  useEffect(charger, [charger]);

  const recue = decharge?.mouvements.some((m) => m.type_evenement === "reception_confirmee") ?? false;
  const positionnee =
    decharge?.mouvements.some((m) => m.type_evenement === "repositionnement") ?? false;

  // Charge les emplacements libres uniquement quand le positionnement devient possible.
  useEffect(() => {
    if (recue && !positionnee) {
      listerEmplacements(true).then(setEmplacements).catch(() => undefined);
    }
  }, [recue, positionnee]);

  async function confirmerReception() {
    if (!decharge) return;
    setErreur(null);
    setSucces(null);
    setEnCours(true);
    try {
      await confirmerReceptionEntrepot(decharge.id, notesReception.trim() || undefined);
      setSucces(t("entrepot.reception_confirmee"));
      charger();
    } catch (e) {
      setErreur(messageErreur(t, e));
    } finally {
      setEnCours(false);
    }
  }

  async function positionner() {
    if (!decharge || !emplacementChoisi) return;
    setErreur(null);
    setSucces(null);
    setEnCours(true);
    try {
      await positionnerDecharge(decharge.id, emplacementChoisi);
      setSucces(t("entrepot.positionnement_confirme"));
      charger();
    } catch (e) {
      setErreur(messageErreur(t, e));
    } finally {
      setEnCours(false);
    }
  }

  function libelleEmplacement(e: EmplacementDTO) {
    return `${e.zone}-${e.allee}-${e.rack}-${e.niveau}`;
  }

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        {!decharge && !erreur && (
          <p className="text-sm text-neutral-500">{t("commun.chargement")}</p>
        )}

        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {erreur}
          </p>
        )}
        {succes && (
          <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            {succes}
          </p>
        )}

        {decharge && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-bold" dir="ltr">
                {t("demandes.decharge_numero", { numero: decharge.numero_decharge })}
              </h1>
              <StatusBadge statut={decharge.statut} />
            </div>

            {/* Informations */}
            <section className="grid grid-cols-1 gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase text-neutral-400">{t("demandes.reference")}</p>
                <p className="mt-1 font-medium" dir="ltr">
                  {decharge.demande.reference}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-neutral-400">{t("demandes.expediteur_col")}</p>
                <p className="mt-1 font-medium">{decharge.expediteur_nom}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-neutral-400">{t("file_attente.produits_approuves")}</p>
                <p className="mt-1 font-medium" dir="ltr">
                  {decharge.produits.length}
                </p>
              </div>
            </section>

            {/* Produits approuvés reçus */}
            <section className="overflow-x-auto rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
              <h2 className="mb-3 text-sm font-semibold">{t("entrepot.marchandise_recue")}</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-xs uppercase text-neutral-500">
                    <th className="py-2 text-start">{t("produit.sku")}</th>
                    <th className="py-2 text-start">{t("produit.designation")}</th>
                    <th className="py-2 text-end">{t("produit.dimensions_court")}</th>
                    <th className="py-2 text-end">{t("produit.quantite")}</th>
                  </tr>
                </thead>
                <tbody>
                  {decharge.produits.map((p) => (
                    <tr key={p.id} className="border-b border-neutral-100">
                      <td className="py-2" dir="ltr">
                        {p.sku_code}
                      </td>
                      <td className="py-2">
                        {p.designation} {p.fragile && <span title={t("produit.fragile")}>⚠</span>}
                      </td>
                      <td className="py-2 text-end" dir="ltr">
                        {p.longueur_cm}×{p.largeur_cm}×{p.hauteur_cm}
                      </td>
                      <td className="py-2 text-end" dir="ltr">
                        {p.quantite}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Actions : réception puis positionnement */}
            <section className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
              <h2 className="text-sm font-semibold">{t("entrepot.actions_titre")}</h2>

              {!recue && (
                <div className="space-y-2">
                  <textarea
                    value={notesReception}
                    onChange={(e) => setNotesReception(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder={t("entrepot.notes_placeholder")}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
                  />
                  <button
                    onClick={confirmerReception}
                    disabled={enCours || decharge.statut !== "scannee"}
                    className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50"
                  >
                    ✓ {t("entrepot.confirmer_reception")}
                  </button>
                </div>
              )}

              {recue && !positionnee && (
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={emplacementChoisi}
                    onChange={(e) => setEmplacementChoisi(e.target.value)}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
                    aria-label={t("entrepot.choisir_emplacement")}
                  >
                    <option value="">{t("entrepot.choisir_emplacement")}</option>
                    {Object.entries(
                      emplacements.reduce<Record<string, EmplacementDTO[]>>((groupes, e) => {
                        (groupes[e.zone] ??= []).push(e);
                        return groupes;
                      }, {}),
                    ).map(([zone, liste]) => (
                      <optgroup key={zone} label={zone}>
                        {liste.map((e) => (
                          <option key={e.id} value={e.id}>
                            {libelleEmplacement(e)} ({t("entrepot.capacite")} {e.capacite_max})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button
                    onClick={positionner}
                    disabled={!emplacementChoisi || enCours}
                    className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
                  >
                    📍 {t("entrepot.positionner")}
                  </button>
                  {emplacements.length === 0 && (
                    <span className="text-xs font-medium text-red-700">{t("erreurs.aucun_emplacement_libre")}</span>
                  )}
                </div>
              )}

              {recue && positionnee && (
                <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
                  {t("entrepot.terminee")}
                </p>
              )}
            </section>

            {/* Timeline des mouvements */}
            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
              <h2 className="mb-4 text-sm font-semibold">{t("entrepot.timeline_titre")}</h2>
              <ol className="space-y-4">
                {decharge.mouvements.map((m) => (
                  <li key={m.id} className="flex gap-3">
                    <span
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-neutral-900"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {t(`evenements.${m.type_evenement}`)}
                        {m.emplacement && (
                          <span className="ms-2 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs" dir="ltr">
                            {m.emplacement.zone}-{m.emplacement.allee}-{m.emplacement.rack}-
                            {m.emplacement.niveau}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500" dir={locale === "ar" ? "rtl" : "ltr"}>
                        {formaterDate(m.date_evenement, locale, true)} · {m.agent_email}
                      </p>
                      {m.notes && <p className="mt-1 text-xs italic text-neutral-600">« {m.notes} »</p>}
                    </div>
                  </li>
                ))}
                {decharge.mouvements.length === 0 && (
                  <li className="text-xs text-neutral-500">{t("entrepot.aucun_mouvement")}</li>
                )}
              </ol>
            </section>

            <Link href="/entrepot" className="inline-block text-xs text-neutral-500 underline hover:text-neutral-800">
              ← {t("commun.retour")}
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
