"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AdminStatsDTO, ExpediteurAdminDTO, Role, StatutExpediteur, UtilisateurAdminDTO } from "@navex/contracts";
import {
  changerStatutExpediteur,
  creerExpediteur,
  creerUtilisateur,
  listerExpediteursAdmin,
  listerUtilisateursAdmin,
  modifierExpediteur,
  modifierUtilisateur,
  statsAdmin,
  supprimerExpediteur,
  supprimerUtilisateur,
} from "@/lib/api-client";
import { formaterDate, messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { RequireRole } from "@/components/require-role";
import { Bouton } from "@/components/bouton";

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

const ACTIONS_STATUT: Array<{ vers: StatutExpediteur; cle: string; variante: "primaire" | "secondaire"; classe: string }> = [
  { vers: "actif", cle: "admin.activer", variante: "primaire", classe: "!bg-navex-ink !text-white hover:!bg-navex-ink/80" },
  { vers: "suspendu", cle: "admin.suspendre", variante: "secondaire", classe: "!border-navex-red/30 !text-navex-red hover:!bg-navex-red-soft" },
  { vers: "en_attente", cle: "admin.remettre_attente", variante: "secondaire", classe: "" },
];

const ROLES_CREABLES: Array<{ value: Role; label: string }> = [
  { value: "expediteur", label: "roles.expediteur" },
  { value: "agent_commercial", label: "roles.agent_commercial" },
  { value: "agent_entrepot", label: "roles.agent_entrepot" },
];

const CHAMP = "mt-1 block w-full rounded-2xl border border-neutral-200/80 bg-white/60 px-4 py-2.5 text-sm shadow-soft transition-all placeholder:text-neutral-400 focus:border-navex-red/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navex-red/10";

export default function PageAdmin() {
  const t = useTranslations();
  const locale = useLocale();
  const [stats, setStats] = useState<AdminStatsDTO | null>(null);
  const [expediteurs, setExpediteurs] = useState<ExpediteurAdminDTO[] | null>(null);
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurAdminDTO[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);

  // ── États formulaires ──
  const [onglet, setOnglet] = useState<"stats" | "creer_compte" | "creer_expediteur">("stats");
  const [formCompte, setFormCompte] = useState({ email: "", mot_de_passe: "", role: "agent_commercial" as Role });
  const [formExpediteur, setFormExpediteur] = useState({ nom_entreprise: "", email: "", telephone: "", adresse: "" });
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  // ── États modification / suppression ──
  const [expEditId, setExpEditId] = useState<string | null>(null);
  const [expEditForm, setExpEditForm] = useState({ nom_entreprise: "", email: "", telephone: "", adresse: "" });
  const [expSupprId, setExpSupprId] = useState<string | null>(null);
  const [userEditId, setUserEditId] = useState<string | null>(null);
  const [userEditForm, setUserEditForm] = useState({ email: "", role: "agent_commercial" as Role, actif: true });
  const [userSupprId, setUserSupprId] = useState<string | null>(null);

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

  async function submitCompte(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null); setSucces(null); setEnvoiEnCours(true);
    try {
      await creerUtilisateur(formCompte);
      setSucces(t("admin.compte_cree"));
      setFormCompte({ email: "", mot_de_passe: "", role: "agent_commercial" });
      charger();
    } catch (err) { setErreur(messageErreur(t, err)); }
    finally { setEnvoiEnCours(false); }
  }

  async function submitExpediteur(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null); setSucces(null); setEnvoiEnCours(true);
    try {
      const resultat = await creerExpediteur(formExpediteur);
      setSucces(t("admin.expediteur_cree", { email: resultat.email, mot_de_passe: resultat.mot_de_passe_defaut }));
      setFormExpediteur({ nom_entreprise: "", email: "", telephone: "", adresse: "" });
      charger();
    } catch (err) { setErreur(messageErreur(t, err)); }
    finally { setEnvoiEnCours(false); }
  }

  // ── Expéditeur : modification ──
  function ouvrirEditExp(e: ExpediteurAdminDTO) {
    setExpEditId(e.id);
    setExpEditForm({ nom_entreprise: e.nom_entreprise, email: e.email, telephone: e.telephone, adresse: e.adresse });
    setExpSupprId(null);
  }

  async function submitEditExp(ev: React.FormEvent) {
    ev.preventDefault();
    if (!expEditId) return;
    setErreur(null); setSucces(null); setActionEnCours(expEditId);
    try {
      await modifierExpediteur(expEditId, expEditForm);
      setSucces(t("admin.expediteur_modifie"));
      setExpEditId(null);
      charger();
    } catch (err) { setErreur(messageErreur(t, err)); }
    finally { setActionEnCours(null); }
  }

  // ── Expéditeur : suppression ──
  async function confirmerSupprExp() {
    if (!expSupprId) return;
    setErreur(null); setSucces(null); setActionEnCours(expSupprId);
    try {
      await supprimerExpediteur(expSupprId);
      setSucces(t("admin.expediteur_supprime"));
      setExpSupprId(null);
      charger();
    } catch (err) { setErreur(messageErreur(t, err)); }
    finally { setActionEnCours(null); }
  }

  // ── Utilisateur : modification ──
  function ouvrirEditUser(u: UtilisateurAdminDTO) {
    setUserEditId(u.id);
    setUserEditForm({ email: u.email, role: u.role, actif: u.actif });
    setUserSupprId(null);
  }

  async function submitEditUser(ev: React.FormEvent) {
    ev.preventDefault();
    if (!userEditId) return;
    setErreur(null); setSucces(null); setActionEnCours(userEditId);
    try {
      await modifierUtilisateur(userEditId, userEditForm);
      setSucces(t("admin.utilisateur_modifie"));
      setUserEditId(null);
      charger();
    } catch (err) { setErreur(messageErreur(t, err)); }
    finally { setActionEnCours(null); }
  }

  // ── Utilisateur : suppression ──
  async function confirmerSupprUser() {
    if (!userSupprId) return;
    setErreur(null); setSucces(null); setActionEnCours(userSupprId);
    try {
      const r = await supprimerUtilisateur(userSupprId);
      setSucces(r.desactive ? t("admin.utilisateur_supprime") : t("admin.utilisateur_supprime"));
      setUserSupprId(null);
      charger();
    } catch (err) { setErreur(messageErreur(t, err)); }
    finally { setActionEnCours(null); }
  }

  return (
    <RequireRole roles={["admin"]}>
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <h1 className="text-2xl font-extrabold text-navex-ink">{t("admin.titre")}</h1>

        {erreur && <p role="alert" className="rounded-2xl bg-navex-red-soft/80 px-4 py-2.5 text-sm text-navex-red-dark backdrop-blur-sm">{erreur}</p>}
        {succes && <p role="status" className="rounded-2xl bg-navex-stone/80 px-4 py-2.5 text-sm text-navex-ink backdrop-blur-sm">{succes}</p>}

        {/* Onglets */}
        <nav role="tablist" className="flex gap-1 rounded-full bg-navex-stone/80 p-1 backdrop-blur-sm">
          {([
            ["stats", "admin.tab_stats"],
            ["creer_compte", "admin.tab_compte"],
            ["creer_expediteur", "admin.tab_expediteur"],
          ] as const).map(([cle, label]) => (
            <button key={cle} role="tab" aria-selected={onglet === cle} onClick={() => setOnglet(cle)}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                onglet === cle ? "bg-white text-navex-ink shadow-soft" : "text-neutral-400 hover:text-navex-ink"
              }`}>
              {t(label)}
            </button>
          ))}
        </nav>

        {/* ── Onglet Stats ── */}
        {onglet === "stats" && (
          <div className="space-y-8">
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
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <CarteKpi label={t("admin.expediteurs_actifs")} valeur={stats.expediteurs_par_statut.actif} />
                  <CarteKpi label={t("admin.decharges_en_cours")} valeur={stats.decharges_par_statut.scannee} />
                </section>
              </>
            )}

            <section className="card-glass-solid rounded-3xl">
              <div className="border-b border-neutral-100/60 px-6 py-4">
                <h2 className="text-sm font-semibold text-navex-ink">{t("admin.expediteurs_titre")}</h2>
              </div>
              <ul className="divide-y divide-neutral-100/60">
                {(expediteurs ?? []).map((e) => (
                  <li key={e.id} className="transition-colors hover:bg-white/40">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
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
                          <Bouton key={a.vers} variante={a.variante} onClick={() => appliquerStatut(e.id, a.vers)} disabled={actionEnCours !== null}
                            className={`!px-3 !py-1.5 !text-xs ${a.classe}`}>
                            {t(a.cle)}
                          </Bouton>
                        ))}
                        <Bouton variante="secondaire" onClick={() => ouvrirEditExp(e)} disabled={actionEnCours !== null}
                          className="!px-3 !py-1.5 !text-xs !border-navex-ink/15 !text-navex-ink/70">
                          {t("admin.modifier")}
                        </Bouton>
                        {e.nb_demandes === 0 && (
                          expSupprId === e.id ? (
                            <div className="flex items-center gap-1">
                              <Bouton variante="primaire" onClick={confirmerSupprExp} disabled={actionEnCours !== null}
                                className="!px-3 !py-1.5 !text-xs">
                                {t("admin.confirmer_suppression")}
                              </Bouton>
                              <Bouton variante="secondaire" onClick={() => setExpSupprId(null)}
                                className="!px-3 !py-1.5 !text-xs !text-neutral-500 !border-neutral-200">
                                {t("commun.annuler")}
                              </Bouton>
                            </div>
                          ) : (
                            <Bouton variante="secondaire" onClick={() => { setExpSupprId(e.id); setExpEditId(null); }} disabled={actionEnCours !== null}
                              className="!px-3 !py-1.5 !text-xs !border-navex-red/30 !text-navex-red hover:!bg-navex-red-soft">
                              {t("admin.supprimer")}
                            </Bouton>
                          )
                        )}
                      </div>
                    </div>
                    {/* Formulaire modification expéditeur */}
                    {expEditId === e.id && (
                      <form onSubmit={submitEditExp} className="border-t border-neutral-100/60 bg-navex-stone/30 px-6 py-4 space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="block text-xs font-medium text-navex-ink">
                            {t("admin.nom_entreprise")}
                            <input required value={expEditForm.nom_entreprise} onChange={(ev) => setExpEditForm((f) => ({ ...f, nom_entreprise: ev.target.value }))} className={CHAMP} />
                          </label>
                          <label className="block text-xs font-medium text-navex-ink">
                            {t("login.email")}
                            <input type="email" required dir="ltr" value={expEditForm.email} onChange={(ev) => setExpEditForm((f) => ({ ...f, email: ev.target.value }))} className={CHAMP} />
                          </label>
                          <label className="block text-xs font-medium text-navex-ink">
                            {t("admin.telephone")}
                            <input type="tel" required dir="ltr" value={expEditForm.telephone} onChange={(ev) => setExpEditForm((f) => ({ ...f, telephone: ev.target.value }))} className={CHAMP} />
                          </label>
                          <label className="block text-xs font-medium text-navex-ink">
                            {t("admin.adresse")}
                            <input required value={expEditForm.adresse} onChange={(ev) => setExpEditForm((f) => ({ ...f, adresse: ev.target.value }))} className={CHAMP} />
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <Bouton type="submit" variante="primaire" disabled={actionEnCours !== null}
                            className="!px-5 !py-2 !text-xs shadow-glow-red">
                            {actionEnCours === e.id ? t("commun.chargement") : t("admin.modifier")}
                          </Bouton>
                          <Bouton type="button" variante="secondaire" onClick={() => setExpEditId(null)}
                            className="!px-5 !py-2 !text-xs !text-neutral-500 !border-neutral-200">
                            {t("commun.annuler")}
                          </Bouton>
                        </div>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {/* ── Onglet Créer un compte ── */}
        {onglet === "creer_compte" && (
          <section className="card-glass rounded-3xl p-6 animate-slide-up">
            <h2 className="mb-4 text-sm font-semibold text-navex-ink">{t("admin.creer_compte_titre")}</h2>
            <form onSubmit={submitCompte} className="space-y-4 max-w-md">
              <label className="block text-sm font-medium text-navex-ink">
                {t("login.email")}
                <input type="email" required dir="ltr" value={formCompte.email} onChange={(e) => setFormCompte((f) => ({ ...f, email: e.target.value }))} className={CHAMP} />
              </label>
              <label className="block text-sm font-medium text-navex-ink">
                {t("login.mot_de_passe")}
                <input type="password" required minLength={8} value={formCompte.mot_de_passe} onChange={(e) => setFormCompte((f) => ({ ...f, mot_de_passe: e.target.value }))} className={CHAMP} />
              </label>
              <label className="block text-sm font-medium text-navex-ink">
                {t("admin.role")}
                <select value={formCompte.role} onChange={(e) => setFormCompte((f) => ({ ...f, role: e.target.value as Role }))} className={CHAMP}>
                  {ROLES_CREABLES.map((r) => <option key={r.value} value={r.value}>{t(r.label)}</option>)}
                </select>
              </label>
              <Bouton type="submit" variante="primaire" disabled={envoiEnCours}
                className="!px-6 !py-2.5 shadow-glow-red">
                {envoiEnCours ? t("commun.chargement") : t("admin.creer_compte")}
              </Bouton>
            </form>
          </section>
        )}

        {/* ── Onglet Créer un expéditeur ── */}
        {onglet === "creer_expediteur" && (
          <section className="card-glass rounded-3xl p-6 animate-slide-up">
            <h2 className="mb-4 text-sm font-semibold text-navex-ink">{t("admin.creer_expediteur_titre")}</h2>
            <form onSubmit={submitExpediteur} className="space-y-4 max-w-md">
              <label className="block text-sm font-medium text-navex-ink">
                {t("admin.nom_entreprise")}
                <input required value={formExpediteur.nom_entreprise} onChange={(e) => setFormExpediteur((f) => ({ ...f, nom_entreprise: e.target.value }))} className={CHAMP} />
              </label>
              <label className="block text-sm font-medium text-navex-ink">
                {t("login.email")}
                <input type="email" required dir="ltr" value={formExpediteur.email} onChange={(e) => setFormExpediteur((f) => ({ ...f, email: e.target.value }))} className={CHAMP} />
              </label>
              <label className="block text-sm font-medium text-navex-ink">
                {t("admin.telephone")}
                <input type="tel" required dir="ltr" value={formExpediteur.telephone} onChange={(e) => setFormExpediteur((f) => ({ ...f, telephone: e.target.value }))} className={CHAMP} />
              </label>
              <label className="block text-sm font-medium text-navex-ink">
                {t("admin.adresse")}
                <input required value={formExpediteur.adresse} onChange={(e) => setFormExpediteur((f) => ({ ...f, adresse: e.target.value }))} className={CHAMP} />
              </label>
              <Bouton type="submit" variante="primaire" disabled={envoiEnCours}
                className="!px-6 !py-2.5 shadow-glow-red">
                {envoiEnCours ? t("commun.chargement") : t("admin.creer_expediteur")}
              </Bouton>
            </form>
          </section>
        )}

        {/* Comptes utilisateurs (toujours visible) */}
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
                <th className="py-2 text-end"></th>
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
                  <td className="py-2 text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Bouton variante="secondaire" onClick={() => ouvrirEditUser(u)} disabled={actionEnCours !== null}
                        className="!px-2.5 !py-1 !text-xs !border-navex-ink/15 !text-navex-ink/70">
                        {t("admin.modifier")}
                      </Bouton>
                      {userSupprId === u.id ? (
                        <div className="flex items-center gap-1">
                          <Bouton variante="primaire" onClick={confirmerSupprUser} disabled={actionEnCours !== null}
                            className="!px-2.5 !py-1 !text-xs">
                            {t("admin.confirmer_suppression")}
                          </Bouton>
                          <Bouton variante="secondaire" onClick={() => setUserSupprId(null)}
                            className="!px-2.5 !py-1 !text-xs !text-neutral-500 !border-neutral-200">
                            {t("commun.annuler")}
                          </Bouton>
                        </div>
                      ) : (
                        <Bouton variante="secondaire" onClick={() => { setUserSupprId(u.id); setUserEditId(null); }} disabled={actionEnCours !== null}
                          className="!px-2.5 !py-1 !text-xs !border-navex-red/30 !text-navex-red hover:!bg-navex-red-soft">
                          {t("admin.supprimer")}
                        </Bouton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Formulaire modification utilisateur (en dessous du tableau) */}
          {userEditId && (
            <form onSubmit={submitEditUser} className="mt-4 border-t border-neutral-100/60 bg-navex-stone/30 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold text-navex-ink">{t("admin.modifier")} — {userEditForm.email}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block text-xs font-medium text-navex-ink">
                  {t("login.email")}
                  <input type="email" required dir="ltr" value={userEditForm.email} onChange={(ev) => setUserEditForm((f) => ({ ...f, email: ev.target.value }))} className={CHAMP} />
                </label>
                <label className="block text-xs font-medium text-navex-ink">
                  {t("admin.role")}
                  <select value={userEditForm.role} onChange={(ev) => setUserEditForm((f) => ({ ...f, role: ev.target.value as Role }))} className={CHAMP}>
                    {ROLES_CREABLES.map((r) => <option key={r.value} value={r.value}>{t(r.label)}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-medium text-navex-ink">
                  {t("admin.compte")}
                  <select value={userEditForm.actif ? "true" : "false"} onChange={(ev) => setUserEditForm((f) => ({ ...f, actif: ev.target.value === "true" }))} className={CHAMP}>
                    <option value="true">{t("statuts.actif_compte")}</option>
                    <option value="false">{t("statuts.inactif")}</option>
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <Bouton type="submit" variante="primaire" disabled={actionEnCours !== null}
                  className="!px-5 !py-2 !text-xs shadow-glow-red">
                  {actionEnCours === userEditId ? t("commun.chargement") : t("admin.modifier")}
                </Bouton>
                <Bouton type="button" variante="secondaire" onClick={() => setUserEditId(null)}
                  className="!px-5 !py-2 !text-xs !text-neutral-500 !border-neutral-200">
                  {t("commun.annuler")}
                </Bouton>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
    </RequireRole>
  );
}
