"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { DechargeEntrepotListeDTO, DemandeListeDTO, UtilisateurDTO } from "@navex/contracts";
import {
  creerExpediteur,
  listerDechargesEntrepot,
  listerDemandes,
  utilisateurCourant,
} from "@/lib/api-client";
import { formaterDate, messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "@/i18n/navigation";
import { Bouton } from "@/components/bouton";

function CarteStat({ label, valeur, hero }: { label: string; valeur: number; hero?: boolean }) {
  if (hero) {
    return (
      <div className="hero-gradient rounded-3xl p-6 shadow-glow-red animate-slide-up">
        <p className="text-xs font-medium uppercase tracking-wider text-white/60">{label}</p>
        <p className="mt-2 text-4xl font-extrabold text-white" dir="ltr">
          {valeur}
        </p>
      </div>
    );
  }
  return (
    <div className="card-glass rounded-3xl p-6 animate-slide-up">
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">{label}</p>
      <p className="mt-2 text-4xl font-extrabold text-navex-ink" dir="ltr">
        {valeur}
      </p>
    </div>
  );
}

export default function PageAccueil() {
  const t = useTranslations();
  const locale = useLocale();

  const [utilisateur, setUtilisateur] = useState<UtilisateurDTO | null>(null);
  const [demandes, setDemandes] = useState<DemandeListeDTO[] | null>(null);
  const [fileAttente, setFileAttente] = useState<DemandeListeDTO[] | null>(null);
  const [fileEntrepot, setFileEntrepot] = useState<DechargeEntrepotListeDTO[] | null>(null);
  const [charge, setCharge] = useState(true);
  const [formExpediteur, setFormExpediteur] = useState({ nom_entreprise: "", email: "", telephone: "", adresse: "" });
  const [formVisible, setFormVisible] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [msgForm, setMsgForm] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    Promise.all([utilisateurCourant(), listerDemandes().catch(() => null)])
      .then(([u, d]) => {
        setUtilisateur(u);
        if (d) setDemandes(d);
        if (u.role === "agent_commercial" || u.role === "admin") {
          listerDemandes(true).then(setFileAttente).catch(() => undefined);
        }
        if (u.role === "agent_entrepot") {
          listerDechargesEntrepot().then(setFileEntrepot).catch(() => undefined);
        }
      })
      .catch(() => window.location.assign(`/${locale}/login`))
      .finally(() => setCharge(false));
  }, [locale]);

  if (charge || !utilisateur) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ambient">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-navex-red border-t-transparent" role="status">
          <span className="sr-only">{t("commun.chargement")}</span>
        </div>
      </main>
    );
  }

  // ── Tableau de bord expéditeur ─────────────────────────────
  if (utilisateur.role === "expediteur") {
    const total = demandes?.length ?? 0;
    const enAttente = demandes?.filter((d) => d.statut === "en_attente").length ?? 0;
    const approuvees = demandes?.filter((d) => d.statut === "approuvee").length ?? 0;
    const decharges = demandes?.filter((d) => d.decharge).length ?? 0;

    return (
      <div className="min-h-dvh">
        <AppHeader />
        <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-extrabold text-navex-ink">
              {t("accueil.titre", { prenom: utilisateur.prenom ?? utilisateur.email.split("@")[0] })}
            </h1>
            <div data-tour="exp-new-demand">
              <Bouton href="/mes-demandes/nouvelle" variante="primaire">
                + {t("demandes.nouvelle")}
              </Bouton>
            </div>
          </div>

          <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <CarteStat label={t("accueil.stats_demandes")} valeur={total} hero />
            <CarteStat label={t("accueil.stats_en_attente")} valeur={enAttente} />
            <CarteStat label={t("accueil.stats_approuvees")} valeur={approuvees} />
            <CarteStat label={t("accueil.stats_decharges")} valeur={decharges} />
          </section>

          <section className="card-glass-solid rounded-3xl animate-slide-up">
            <div className="flex items-center justify-between border-b border-neutral-100/60 px-6 py-4">
              <h2 className="text-sm font-semibold text-navex-ink">{t("accueil.dernieres")}</h2>
              {total > 3 && (
                <Bouton href="/mes-demandes" variante="secondaire">
                  {t("accueil.voir_toutes")}
                </Bouton>
              )}
            </div>

            {(demandes?.length ?? 0) === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-neutral-500">{t("demandes.vide")}</p>
            ) : (
              <ul className="divide-y divide-neutral-100/60">
                {demandes?.slice(0, 3).map((d) => (
                  <li key={d.id} data-tour="exp-demand-row" className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 transition-colors hover:bg-white/40">
                    <div>
                      <span className="text-sm font-semibold text-navex-ink" dir="ltr">
                        {d.reference}
                      </span>
                      <span className="ms-2 text-xs text-neutral-400">
                        {formaterDate(d.date_creation, locale)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {d.decharge && (
                        <span className="text-xs text-neutral-400" dir="ltr">
                          {d.decharge.numero_decharge}
                        </span>
                      )}
                      <StatusBadge statut={d.statut} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>

        <footer className="border-t border-navex-red/10 bg-navex-red-soft/30 backdrop-blur-sm">
          <div className="mx-auto max-w-4xl px-4 py-6 text-center space-y-1">
            <p className="text-xs font-semibold text-navex-red-dark">{t("accueil.footer_contact")}</p>
            <p className="text-sm font-bold text-navex-red tracking-wide" dir="ltr">{t("accueil.footer_numeros")}</p>
          </div>
        </footer>
      </div>
    );
  }

  // ── Tableau de bord agent entrepôt ──────────────────────────
  if (utilisateur.role === "agent_entrepot") {
    const aRecevoir = fileEntrepot?.filter((d) => !d.evenements.includes("reception_confirmee")).length ?? 0;
    const aPositionner =
      fileEntrepot?.filter(
        (d) => d.evenements.includes("reception_confirmee") && !d.evenements.includes("repositionnement"),
      ).length ?? 0;

    return (
      <div className="min-h-dvh">
        <AppHeader />
        <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
          <h1 className="text-2xl font-extrabold text-navex-ink">
            {t("accueil.titre", { prenom: utilisateur.prenom ?? utilisateur.email.split("@")[0] })}
          </h1>

          <section className="grid grid-cols-2 gap-4">
            <CarteStat label={t("entrepot.attente_reception")} valeur={aRecevoir} hero />
            <CarteStat label={t("entrepot.attente_positionnement")} valeur={aPositionner} />
          </section>

          <section className="card-glass-solid rounded-3xl animate-slide-up">
            <div className="flex items-center justify-between border-b border-neutral-100/60 px-6 py-4">
              <h2 className="text-sm font-semibold text-navex-ink">{t("entrepot.file_titre")}</h2>
              <Bouton href="/entrepot" variante="secondaire">
                {t("entrepot.tout_voir")}
              </Bouton>
            </div>

            {(fileEntrepot?.length ?? 0) === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-neutral-500">{t("entrepot.file_vide")}</p>
            ) : (
              <ul className="divide-y divide-neutral-100/60">
                {fileEntrepot?.slice(0, 5).map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 transition-colors hover:bg-white/40">
                    <Link
                      href={`/entrepot/decharges/${d.id}`}
                      className="text-sm font-semibold text-navex-ink hover:underline"
                      dir="ltr"
                    >
                      {d.numero_decharge}
                    </Link>
                    <span className="text-xs text-neutral-400" dir="ltr">
                      {d.demande.reference}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    );
  }

  // ── Tableau de bord agent commercial ────────────────────────
  if (utilisateur.role === "agent_commercial") {
    const enFile = fileAttente?.length ?? 0;
    const produitsADecider =
      fileAttente?.reduce(
        (n, d) => n + (d.produits?.filter((p) => p.statut_validation === "en_attente").length ?? 0),
        0,
      ) ?? 0;

    async function submitExpediteur(ev: React.FormEvent) {
      ev.preventDefault();
      setEnvoiEnCours(true); setMsgForm(null);
      try {
        const r = await creerExpediteur({
          ...formExpediteur,
        });
        setMsgForm({ type: "ok", text: `${r.nom_entreprise} — ${r.email} / ${r.mot_de_passe_defaut}` });
        setFormExpediteur({ nom_entreprise: "", email: "", telephone: "", adresse: "" });
        setFormVisible(false);
      } catch (err) {
        setMsgForm({ type: "err", text: messageErreur(t, err) });
      } finally { setEnvoiEnCours(false); }
    }

    return (
      <div className="min-h-dvh">
        <AppHeader />
        <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
          <h1 className="text-2xl font-extrabold text-navex-ink">
            {t("accueil.titre", { prenom: utilisateur.prenom ?? utilisateur.email.split("@")[0] })}
          </h1>

          <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <CarteStat label={t("accueil.stats_file")} valeur={enFile} hero />
            <CarteStat label={t("accueil.stats_produits_a_decider")} valeur={produitsADecider} />
            <CarteStat label={t("accueil.stats_total_demandes")} valeur={demandes?.length ?? 0} />
          </section>

          {/* Ajouter un expéditeur */}
          <section className="card-glass rounded-3xl p-6 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-navex-ink">{t("admin.creer_expediteur_titre")}</h2>
              <Bouton onClick={() => setFormVisible((v) => !v)} variante="secondaire">
                {formVisible ? t("commun.annuler") : "+ " + t("admin.creer_expediteur")}
              </Bouton>
            </div>
            {msgForm && (
              <p className={`mt-3 rounded-2xl px-4 py-2.5 text-sm backdrop-blur-sm ${msgForm.type === "ok" ? "bg-navex-stone/80 text-navex-ink" : "bg-navex-red-soft/80 text-navex-red-dark"}`}>
                {msgForm.type === "ok" ? `✓ ${t("admin.expediteur_cree_simple")}` : msgForm.text}
                {msgForm.type === "ok" && <span className="ms-2 font-mono text-xs">{msgForm.text}</span>}
              </p>
            )}
            {formVisible && (
              <form onSubmit={submitExpediteur} className="mt-4 space-y-3">
                <input required placeholder={t("admin.nom_entreprise")} value={formExpediteur.nom_entreprise} onChange={(e) => setFormExpediteur((f) => ({ ...f, nom_entreprise: e.target.value }))}
                  className="w-full rounded-2xl border border-neutral-200/80 bg-white/60 px-4 py-2.5 text-sm shadow-soft focus:border-navex-red/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navex-red/10" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input type="email" required dir="ltr" placeholder={t("login.email")} value={formExpediteur.email} onChange={(e) => setFormExpediteur((f) => ({ ...f, email: e.target.value }))}
                    className="rounded-2xl border border-neutral-200/80 bg-white/60 px-4 py-2.5 text-sm shadow-soft focus:border-navex-red/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navex-red/10" />
                  <input type="tel" required dir="ltr" placeholder={t("admin.telephone")} value={formExpediteur.telephone} onChange={(e) => setFormExpediteur((f) => ({ ...f, telephone: e.target.value }))}
                    className="rounded-2xl border border-neutral-200/80 bg-white/60 px-4 py-2.5 text-sm shadow-soft focus:border-navex-red/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navex-red/10" />
                </div>
                <input required placeholder={t("admin.adresse")} value={formExpediteur.adresse} onChange={(e) => setFormExpediteur((f) => ({ ...f, adresse: e.target.value }))}
                  className="w-full rounded-2xl border border-neutral-200/80 bg-white/60 px-4 py-2.5 text-sm shadow-soft focus:border-navex-red/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navex-red/10" />
                <Bouton type="submit" disabled={envoiEnCours} variante="primaire">
                  {envoiEnCours ? t("commun.chargement") : t("admin.creer_expediteur")}
                </Bouton>
              </form>
            )}
          </section>

          <section data-tour="ac-queue-section" className="card-glass-solid rounded-3xl animate-slide-up">
            <div className="flex items-center justify-between border-b border-neutral-100/60 px-6 py-4">
              <h2 className="text-sm font-semibold text-navex-ink">{t("file_attente.titre")}</h2>
              <Bouton href="/file-attente" variante="secondaire">
                {t("file_attente.tout_voir")}
              </Bouton>
            </div>

            {enFile === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-neutral-500">{t("file_attente.vide")}</p>
            ) : (
              <ul className="divide-y divide-neutral-100/60">
                {fileAttente?.slice(0, 5).map((d) => {
                  const totalP = d._count?.produits ?? d.produits?.length ?? 0;
                  const traites =
                    d.produits?.filter((p) => p.statut_validation !== "en_attente").length ?? 0;
                  return (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 transition-colors hover:bg-white/40">
                      <div>
                        <Link href={`/mes-demandes/${d.id}`} className="text-sm font-semibold text-navex-ink hover:underline" dir="ltr">
                          {d.reference}
                        </Link>
                        <span className="ms-2 text-xs text-neutral-400">{d.expediteur.nom_entreprise}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-neutral-400" dir="ltr">
                          {traites}/{totalP}
                        </span>
                        <StatusBadge statut={d.statut} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </main>
      </div>
    );
  }

  // ── Tableau de bord administrateur ──────────────────────────
  if (utilisateur.role === "admin") {
    const parExpediteur = new Map<string, { nom: string; demandes: DemandeListeDTO[] }>();
    for (const d of demandes ?? []) {
      const key = d.expediteur.id;
      const entry = parExpediteur.get(key);
      if (entry) { entry.demandes.push(d); }
      else { parExpediteur.set(key, { nom: d.expediteur.nom_entreprise, demandes: [d] }); }
    }

    return (
      <div className="min-h-dvh">
        <AppHeader />
        <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-extrabold text-navex-ink">
              {t("accueil.titre", { role: t("roles.admin") })}
            </h1>
            <Bouton href="/admin" variante="primaire">
              {t("admin.titre")}
            </Bouton>
          </div>

          <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <CarteStat label={t("accueil.stats_demandes")} valeur={demandes?.length ?? 0} hero />
            <CarteStat label={t("accueil.stats_en_attente")} valeur={demandes?.filter((d) => d.statut === "en_attente").length ?? 0} />
            <CarteStat label={t("accueil.stats_approuvees")} valeur={demandes?.filter((d) => d.statut === "approuvee").length ?? 0} />
            <CarteStat label={t("admin.expediteurs_actifs")} valeur={parExpediteur.size} />
          </section>

          {[...parExpediteur.entries()].map(([id, { nom, demandes: dmds }]) => (
            <section key={id} className="card-glass-solid rounded-3xl animate-slide-up">
              <div className="flex items-center justify-between border-b border-neutral-100/60 px-6 py-4">
                <h2 className="text-sm font-semibold text-navex-ink">{nom}</h2>
                <span className="text-xs text-neutral-400">{dmds.length} {t("demandes.produits_col").toLowerCase()}</span>
              </div>
              <ul className="divide-y divide-neutral-100/60">
                {dmds.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 transition-colors hover:bg-white/40">
                    <div>
                      <span className="text-sm font-semibold text-navex-ink" dir="ltr">{d.reference}</span>
                      <span className="ms-2 text-xs text-neutral-400">{formaterDate(d.date_creation, locale)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {d.decharge && (
                        <span className="text-xs text-neutral-400" dir="ltr">{d.decharge.numero_decharge}</span>
                      )}
                      <StatusBadge statut={d.statut} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {(!demandes || demandes.length === 0) && (
            <p className="card-glass rounded-3xl p-10 text-center text-sm text-neutral-500">{t("demandes.vide")}</p>
          )}
        </main>
      </div>
    );
  }

  // ── Autres rôles : vue simple ──
  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <section className="card-glass-solid rounded-3xl p-6 animate-slide-up">
          <p className="text-sm text-neutral-500">{t("accueil.session")}</p>
          <p className="mt-1 font-semibold text-navex-ink" dir="ltr">
            {utilisateur.email}
          </p>

          <h2 className="mt-4 text-lg font-bold text-navex-ink">
            {t("accueil.titre", { prenom: utilisateur.prenom ?? utilisateur.email.split("@")[0] })}
          </h2>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <StatusBadge statut="en_attente" />
            <StatusBadge statut="approuve" />
            <StatusBadge statut="refuse" />
          </div>
        </section>
      </main>
    </div>
  );
}
