"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  AdminStatsDTO,
  ExpediteurAdminDTO,
  StatutExpediteur,
  UtilisateurAdminDTO,
} from "@navex/contracts";
import {
  changerStatutExpediteur,
  listerExpediteursAdmin,
  listerUtilisateursAdmin,
  statsAdmin,
} from "@/lib/api-client";
import { formaterDate, messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";

function CarteKpi({ label, valeur }: { label: string; valeur: number }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
      <p className="text-xs uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-neutral-900" dir="ltr">
        {valeur}
      </p>
    </div>
  );
}

const ACTIONS_STATUT: Array<{ vers: StatutExpediteur; cle: string; classe: string }> = [
  { vers: "actif", cle: "admin.activer", classe: "bg-green-700 hover:bg-green-600" },
  { vers: "suspendu", cle: "admin.suspendre", classe: "bg-red-700 hover:bg-red-600" },
  { vers: "en_attente", cle: "admin.remettre_attente", classe: "border border-neutral-400 hover:bg-neutral-100 !text-neutral-700" },
];

export default function PageAdmin() {
  const t = useTranslations();
  const locale = useLocale();
  const [stats, setStats] = useState<AdminStatsDTO | null>(null);
  const [expediteurs, setExpediteurs] = useState<ExpediteurAdminDTO[] | null>(null);
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurAdminDTO[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);

  const charger = useCallback(() => {
    Promise.all([statsAdmin(), listerExpediteursAdmin(), listerUtilisateursAdmin()])
      .then(([s, e, u]) => {
        setStats(s);
        setExpediteurs(e);
        setUtilisateurs(u);
      })
      .catch((err) => setErreur(messageErreur(t, err)));
  }, [t]);

  useEffect(charger, [charger]);

  async function appliquerStatut(id: string, statut: StatutExpediteur) {
    setErreur(null);
    setSucces(null);
    setActionEnCours(`${id}:${statut}`);
    try {
      await changerStatutExpediteur(id, { statut });
      setSucces(t("admin.statut_modifie"));
      charger();
    } catch (e) {
      setErreur(messageErreur(t, e));
    } finally {
      setActionEnCours(null);
    }
  }

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <h1 className="text-xl font-bold">{t("admin.titre")}</h1>

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

        {/* KPIs */}
        {stats && (
          <>
            <section>
              <h2 className="mb-3 text-sm font-semibold">{t("admin.kpis_demandes")}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <CarteKpi label={t("statuts.en_attente")} valeur={stats.demandes_par_statut.en_attente} />
                <CarteKpi label={t("statuts.approuvee")} valeur={stats.demandes_par_statut.approuvee} />
                <CarteKpi label={t("statuts.rejetee")} valeur={stats.demandes_par_statut.rejetee} />
                <CarteKpi label={t("admin.produits_a_decider")} valeur={stats.produits_en_attente} />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
                <p className="text-xs uppercase tracking-wide text-neutral-400">
                  {t("admin.occupation_entrepot")}
                </p>
                <p className="mt-1 text-2xl font-bold" dir="ltr">
                  {stats.emplacements.total > 0
                    ? Math.round((stats.emplacements.occupes / stats.emplacements.total) * 100)
                    : 0}
                  %
                </p>
                <p className="text-xs text-neutral-500" dir="ltr">
                  {stats.emplacements.occupes}/{stats.emplacements.total}
                </p>
              </div>
              <CarteKpi label={t("admin.expediteurs_actifs")} valeur={stats.expediteurs_par_statut.actif} />
              <CarteKpi label={t("admin.decharges_en_cours")} valeur={stats.decharges_par_statut.scannee} />
            </section>
          </>
        )}

        {/* Expéditeurs */}
        <section className="rounded-xl bg-white shadow-sm ring-1 ring-neutral-200">
          <div className="border-b border-neutral-100 px-5 py-3">
            <h2 className="text-sm font-semibold">{t("admin.expediteurs_titre")}</h2>
          </div>

          {!expediteurs && !erreur && (
            <p className="px-5 py-8 text-center text-sm text-neutral-500">{t("commun.chargement")}</p>
          )}

          <ul className="divide-y divide-neutral-100">
            {(expediteurs ?? []).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-48 space-y-0.5">
                  <p className="font-medium">{e.nom_entreprise}</p>
                  <p className="text-xs text-neutral-500" dir="ltr">
                    {e.email} · {e.telephone}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {t("admin.nb_utilisateurs", { nombre: e.nb_utilisateurs })} ·{" "}
                    {t("admin.nb_demandes", { nombre: e.nb_demandes })} ·{" "}
                    {formaterDate(e.date_creation, locale)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge statut={e.statut} />
                  {ACTIONS_STATUT.filter((a) => a.vers !== e.statut).map((a) => (
                    <button
                      key={a.vers}
                      onClick={() => appliquerStatut(e.id, a.vers)}
                      disabled={actionEnCours !== null}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${a.classe}`}
                    >
                      {t(a.cle)}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Comptes utilisateurs */}
        <section className="overflow-x-auto rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-3 text-sm font-semibold">{t("admin.utilisateurs_titre")}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs uppercase text-neutral-500">
                <th className="py-2 text-start">{t("login.email")}</th>
                <th className="py-2 text-start">{t("admin.role")}</th>
                <th className="py-2 text-start">{t("demandes.expediteur_col")}</th>
                <th className="py-2 text-start">{t("admin.compte")}</th>
                <th className="py-2 text-start">{t("demandes.date_creation")}</th>
              </tr>
            </thead>
            <tbody>
              {(utilisateurs ?? []).map((u) => (
                <tr key={u.id} className="border-b border-neutral-100">
                  <td className="py-2" dir="ltr">
                    {u.email}
                  </td>
                  <td className="py-2">{t(`roles.${u.role}`)}</td>
                  <td className="py-2">{u.expediteur_nom ?? "—"}</td>
                  <td className="py-2">
                    <StatusBadge statut={u.actif ? "actif_compte" : "inactif"} />
                  </td>
                  <td className="py-2">{formaterDate(u.date_creation, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
