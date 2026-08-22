"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { DemandeDetailDTO } from "@navex/contracts";
import { detailDemande, genererDecharge, telechargerDechargePdf } from "@/lib/api-client";
import { formaterDate, messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";

export default function PageDetailDemande() {
  const t = useTranslations();
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [demande, setDemande] = useState<DemandeDetailDTO | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCoursPdf, setEnCoursPdf] = useState(false);
  const [enCoursGeneration, setEnCoursGeneration] = useState(false);

  const charger = useCallback(() => {
    if (!id) return;
    detailDemande(id)
      .then(setDemande)
      .catch((e) => setErreur(messageErreur(t, e)));
  }, [id, t]);

  useEffect(charger, [charger]);

  async function generer() {
    if (!demande) return;
    setErreur(null);
    setEnCoursGeneration(true);
    try {
      await genererDecharge(demande.id);
      charger();
    } catch (e) {
      setErreur(messageErreur(t, e));
    } finally {
      setEnCoursGeneration(false);
    }
  }

  async function telechargerPdf() {
    if (!demande?.decharge) return;
    setErreur(null);
    setEnCoursPdf(true);
    try {
      await telechargerDechargePdf(demande.decharge.id, `${demande.decharge.numero_decharge}.pdf`);
    } catch (e) {
      setErreur(messageErreur(t, e));
    } finally {
      setEnCoursPdf(false);
    }
  }

  if (erreur && !demande) {
    return (
      <div className="min-h-dvh">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {erreur}
          </p>
        </main>
      </div>
    );
  }

  if (!demande) {
    return (
      <div className="min-h-dvh">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <p className="text-sm text-neutral-500">{t("commun.chargement")}</p>
        </main>
      </div>
    );
  }

  const auMoinsUnApprouve = demande.produits.some((p) => p.statut_validation === "approuve");

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-3 text-xl font-bold">
            <span dir="ltr">{t("demandes.detail_titre", { reference: demande.reference })}</span>
          </h1>
          <StatusBadge statut={demande.statut} />
        </div>

        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {erreur}
          </p>
        )}

        {/* Informations générales */}
        <section className="grid grid-cols-1 gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-neutral-400">{t("demandes.expediteur_col")}</p>
            <p className="mt-1 font-medium">{demande.expediteur.nom_entreprise}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-neutral-400">{t("demandes.date_creation")}</p>
            <p className="mt-1">{formaterDate(demande.date_creation, locale, true)}</p>
          </div>
          {demande.date_reception_prevue && (
            <div>
              <p className="text-xs uppercase text-neutral-400">{t("demandes.date_reception_prevue")}</p>
              <p className="mt-1">{formaterDate(demande.date_reception_prevue, locale)}</p>
            </div>
          )}
          {demande.commentaire_agent && (
            <div>
              <p className="text-xs uppercase text-neutral-400">{t("demandes.commentaire_agent")}</p>
              <p className="mt-1">{demande.commentaire_agent}</p>
            </div>
          )}
        </section>

        {/* Produits */}
        <section className="overflow-x-auto rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-3 text-sm font-semibold">{t("demandes.produits_titre")}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs uppercase text-neutral-500">
                <th className="py-2 text-start">{t("produit.sku")}</th>
                <th className="py-2 text-start">{t("produit.designation")}</th>
                <th className="py-2 text-end">{t("produit.dimensions_court")}</th>
                <th className="py-2 text-end">{t("produit.quantite")}</th>
                <th className="py-2 text-end">Statut</th>
              </tr>
            </thead>
            <tbody>
              {demande.produits.map((p) => (
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
                  <td className="py-2 text-end">
                    <StatusBadge statut={p.statut_validation} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Décharge */}
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-3 text-sm font-semibold">{t("demandes.decharge_titre")}</h2>
          {demande.decharge ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium" dir="ltr">
                  {t("demandes.decharge_numero", { numero: demande.decharge.numero_decharge })}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  <StatusBadge statut={demande.decharge.statut} />
                </p>
              </div>
              <button
                onClick={telechargerPdf}
                disabled={enCoursPdf}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
              >
                {enCoursPdf ? t("demandes.generation_cours") : t("demandes.telecharger_pdf")}
              </button>
            </div>
          ) : auMoinsUnApprouve ? (
            <button
              onClick={generer}
              disabled={enCoursGeneration}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {enCoursGeneration ? t("demandes.generation_cours") : t("demandes.generer_decharge")}
            </button>
          ) : (
            <p className="text-xs text-neutral-500">{t("erreurs.aucun_produit_approuve")}</p>
          )}
        </section>

        <Link href="/mes-demandes" className="inline-block text-xs text-neutral-500 underline hover:text-neutral-800">
          ← {t("commun.retour")}
        </Link>
      </main>
    </div>
  );
}
