"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AdminStatsDTO, ExpediteurAdminDTO, StatutExpediteur, UtilisateurAdminDTO } from "@navex/contracts";
import { changerStatutExpediteur, listerExpediteursAdmin, listerUtilisateursAdmin, statsAdmin } from "@/lib/api-client";
import { formaterDate, messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";

function CarteKpi({ label, valeur, hero }: { label: string; valeur: number; hero?: boolean }) {
  if (hero) {
    return (
      <div className="hero-gradient rounded-3xl p-6 shadow-glow-red animate-slide-up">
        <p className="text-xs font-medium uppercase tracking-wider text-white/60">{label}</p>
        <p className="mt-2 text-4xl font-extrabold text-white" dir="ltr">{valeur}</p>
      </div>
    );
  }
  return (
    <div className="card-glass rounded-3xl p-6 animate-slide-up">
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">{label}</p>
      <p className="mt-2 text-4xl font-extrabold text-navex-ink" dir="ltr">{valeur}</p>
    </div>
  );
}

const ACTIONS_STATUT: Array<{ vers: StatutExpediteur; cle: string; classe: string }> = [
  { vers: "actif", cle: "admin.activer", classe: "bg-navex-ink text-white hover:bg-navex-ink/80" },
  { vers: "suspendu", cle: "admin.suspendre", classe: "bg-navex-red text-white hover:bg-navex-red-dark" },
  { vers: "en_attente", cle: "admin.remettre_attente", classe: "border border-navex-ink/15 text-navex-ink/70 hover:bg-navex-stone" },
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
      .then(([s, e, u]) => { setStats(s); setExpediteurs(e); setUtilisateurs(u); })
      .catch((err) => setErreur(messageErreur(t, err)));
  }, [t]);

  useEffect(charger, [charger]);

  async function appliquerStatut(id: string, statut: StatutExpediteur) {
    setErreur(null); setSucces(null); setActionEnCours(`${id}:${statut}`);
    try { await changerStatutExpediteur(id, { statut }); setSucces(t("admin.statut_modifie")); charger(); }
    catch (e) { setErreur(messageErreur(t, e)); }
    finally { setActionEnCours(null); }
  }

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <h1 className="text-2xl font-extrabold text-navex-ink">{t("admin.titre")}</h1>

        {erreur && <p role="alert" className="rounded-2xl bg-navex-red-soft/80 px-4 py-2.5 text-sm text-navex-red-dark backdrop-blur-sm">{erreur}</p>}
        {succes && <p role="status" className="rounded-2xl bg-navex-stone/80 px-4 py-2.5 text-sm text-navex-ink backdrop-blur-sm">{succes}</p>}

        {stats && (
          <>
            <section>
              <h2 className="mb-3 text-sm font-semibold text-navex-ink">{t("admin.kpis_demandes")}</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <CarteKpi label={t("statuts.en_attente")} valeur={stats.demandes_par_statut.en_attente} hero />
                <CarteKpi label={t("statuts.approuvee")} valeur={stats.demandes_par_statut.approuvee} />
                <CarteKpi label={t("statuts.rejetee")} valeur={stats.demandes_par_statut.rejetee} />
                <CarteKpi label={t("admin.produits_a_decider")} valeur={stats.produits_en_attente} />
              </div>
            </section>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="card-glass rounded-3xl p-6">
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">{t("admin.occupation_entrepot")}</p>
                <p className="mt-2 text-3xl font-extrabold text-navex-ink" dir="ltr">
                  {stats.emplacements.total > 0 ? Math.round((stats.emplacements.occupes / stats.emplacements.total) * 100) : 0}%
                </p>
                <p className="text-xs text-neutral-400" dir="ltr">{stats.emplacements.occupes}/{stats.emplacements.total}</p>
              </div>
              <CarteKpi label={t("admin.expediteurs_actifs")} valeur={stats.expediteurs_par_statut.actif} />
              <CarteKpi label={t("admin.decharges_en_cours")} valeur={stats.decharges_par_statut.scannee} />
            </section>
          </>
        )}

        <section className="card-glass-solid rounded-3xl">
          <div className="border-b border-neutral-100/60 px-6 py-4">
            <h2 className="text-sm font-semibold text-navex-ink">{t("admin.expediteurs_titre")}</h2>
          </div>
          {!expediteurs && !erreur && <p className="px-6 py-10 text-center text-sm text-neutral-500">{t("commun.chargement")}</p>}
          <ul className="divide-y divide-neutral-100/60">
            {(expediteurs ?? []).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-white/40">
                <div className="min-w-48 space-y-0.5">
                  <p className="font-medium text-navex-ink">{e.nom_entreprise}</p>
                  <p className="text-xs text-neutral-400" dir="ltr">{e.email} · {e.telephone}</p>
                  <p className="text-xs text-neutral-400">
                    {t("admin.nb_utilisateurs", { nombre: e.nb_utilisateurs })} · {t("admin.nb_demandes", { nombre: e.nb_demandes })} · {formaterDate(e.date_creation, locale)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge statut={e.statut} />
                  {ACTIONS_STATUT.filter((a) => a.vers !== e.statut).map((a) => (
                    <button key={a.vers} onClick={() => appliquerStatut(e.id, a.vers)} disabled={actionEnCours !== null}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${a.classe}`}>
                      {t(a.cle)}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="overflow-x-auto card-glass-solid rounded-3xl p-6">
          <h2 className="mb-3 text-sm font-semibold text-navex-ink">{t("admin.utilisateurs_titre")}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200/60 text-xs uppercase text-neutral-400">
                <th className="py-2 text-start">{t("login.email")}</th>
                <th className="py-2 text-start">{t("admin.role")}</th>
                <th className="py-2 text-start">{t("demandes.expediteur_col")}</th>
                <th className="py-2 text-start">{t("admin.compte")}</th>
                <th className="py-2 text-start">{t("demandes.date_creation")}</th>
              </tr>
            </thead>
            <tbody>
              {(utilisateurs ?? []).map((u) => (
                <tr key={u.id} className="border-b border-neutral-100/60">
                  <td className="py-2 text-navex-ink" dir="ltr">{u.email}</td>
                  <td className="py-2 text-navex-ink">{t(`roles.${u.role}`)}</td>
                  <td className="py-2 text-navex-ink">{u.expediteur_nom ?? "—"}</td>
                  <td className="py-2"><StatusBadge statut={u.actif ? "actif_compte" : "inactif"} /></td>
                  <td className="py-2 text-navex-ink">{formaterDate(u.date_creation, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
