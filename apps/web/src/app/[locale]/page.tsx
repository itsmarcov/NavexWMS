"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { DechargeEntrepotListeDTO, DemandeListeDTO, UtilisateurDTO } from "@navex/contracts";
import {
  listerDechargesEntrepot,
  listerDemandes,
  utilisateurCourant,
} from "@/lib/api-client";
import { formaterDate } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "@/i18n/navigation";

function CarteStat({ label, valeur, hero }: { label: string; valeur: number; hero?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-5 shadow-sm ${
        hero
          ? "bg-gradient-to-br from-navex-red to-navex-red-dark text-white"
          : "bg-white ring-1 ring-neutral-200"
      }`}
    >
      <p className={`text-xs uppercase tracking-wide ${hero ? "text-white/70" : "text-neutral-400"}`}>
        {label}
      </p>
      <p className={`mt-1 text-3xl font-bold ${hero ? "text-white" : "text-navex-ink"}`} dir="ltr">
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
      <main className="flex min-h-dvh items-center justify-center bg-navex-stone">
        <p className="text-sm text-neutral-500">{t("commun.chargement")}</p>
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
            <h1 className="text-xl font-bold text-navex-ink">
              {t("accueil.titre", { role: t("roles.expediteur") })}
            </h1>
            <a
              href="/mes-demandes/nouvelle"
              className="rounded-full bg-navex-red px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-navex-red-dark"
            >
              + {t("demandes.nouvelle")}
            </a>
          </div>

          <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <CarteStat label={t("accueil.stats_demandes")} valeur={total} hero />
            <CarteStat label={t("accueil.stats_en_attente")} valeur={enAttente} />
            <CarteStat label={t("accueil.stats_approuvees")} valeur={approuvees} />
            <CarteStat label={t("accueil.stats_decharges")} valeur={decharges} />
          </section>

          <section className="rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-navex-ink">{t("accueil.dernieres")}</h2>
              {total > 3 && (
                <Link href="/mes-demandes" className="text-xs font-medium text-navex-red hover:text-navex-red-dark">
                  {t("accueil.voir_toutes")}
                </Link>
              )}
            </div>

            {(demandes?.length ?? 0) === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-neutral-500">{t("demandes.vide")}</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {demandes?.slice(0, 3).map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <div>
                      <span className="text-sm font-semibold text-navex-ink" dir="ltr">
                        {d.reference}
                      </span>
                      <span className="ms-2 text-xs text-neutral-500">
                        {formaterDate(d.date_creation, locale)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {d.decharge && (
                        <span className="text-xs text-neutral-500" dir="ltr">
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
          <h1 className="text-xl font-bold text-navex-ink">
            {t("accueil.titre", { role: t("roles.agent_entrepot") })}
          </h1>

          <section className="grid grid-cols-2 gap-4">
            <CarteStat label={t("entrepot.attente_reception")} valeur={aRecevoir} hero />
            <CarteStat label={t("entrepot.attente_positionnement")} valeur={aPositionner} />
          </section>

          <section className="rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-navex-ink">{t("entrepot.file_titre")}</h2>
              <Link href="/entrepot" className="text-xs font-medium text-navex-red hover:text-navex-red-dark">
                {t("entrepot.tout_voir")}
              </Link>
            </div>

            {(fileEntrepot?.length ?? 0) === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-neutral-500">{t("entrepot.file_vide")}</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {fileEntrepot?.slice(0, 5).map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <Link
                      href={`/entrepot/decharges/${d.id}`}
                      className="text-sm font-semibold text-navex-ink hover:underline"
                      dir="ltr"
                    >
                      {d.numero_decharge}
                    </Link>
                    <span className="text-xs text-neutral-500" dir="ltr">
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

    return (
      <div className="min-h-dvh">
        <AppHeader />
        <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
          <h1 className="text-xl font-bold text-navex-ink">
            {t("accueil.titre", { role: t(`roles.${utilisateur.role}`) })}
          </h1>

          <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <CarteStat label={t("accueil.stats_file")} valeur={enFile} hero />
            <CarteStat label={t("accueil.stats_produits_a_decider")} valeur={produitsADecider} />
            <CarteStat label={t("accueil.stats_total_demandes")} valeur={demandes?.length ?? 0} />
          </section>

          <section className="rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-navex-ink">{t("file_attente.titre")}</h2>
              <Link href="/file-attente" className="text-xs font-medium text-navex-red hover:text-navex-red-dark">
                {t("file_attente.tout_voir")}
              </Link>
            </div>

            {enFile === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-neutral-500">{t("file_attente.vide")}</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {fileAttente?.slice(0, 5).map((d) => {
                  const totalP = d._count?.produits ?? d.produits?.length ?? 0;
                  const traites =
                    d.produits?.filter((p) => p.statut_validation !== "en_attente").length ?? 0;
                  return (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                      <div>
                        <Link href={`/mes-demandes/${d.id}`} className="text-sm font-semibold text-navex-ink hover:underline" dir="ltr">
                          {d.reference}
                        </Link>
                        <span className="ms-2 text-xs text-neutral-500">{d.expediteur.nom_entreprise}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-neutral-500" dir="ltr">
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
    return (
      <div className="min-h-dvh">
        <AppHeader />
        <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
          <h1 className="text-xl font-bold text-navex-ink">{t("accueil.titre", { role: t("roles.admin") })}</h1>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 space-y-2">
            <p className="text-sm text-neutral-500">{t("accueil.session")}</p>
            <p className="font-medium text-navex-ink" dir="ltr">
              {utilisateur.email}
            </p>
          </section>

          <Link
            href="/admin"
            className="block rounded-2xl bg-gradient-to-br from-navex-red to-navex-red-dark px-6 py-8 text-center shadow-sm transition-opacity hover:opacity-90"
          >
            <p className="text-lg font-semibold text-white">{t("admin.titre")}</p>
            <p className="mt-1 text-xs text-white/70">{t("admin.sous_titre")}</p>
          </Link>
        </main>
      </div>
    );
  }

  // ── Autres rôles : vue simple ──
  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-500">{t("accueil.session")}</p>
          <p className="mt-1 font-medium text-navex-ink" dir="ltr">
            {utilisateur.email}
          </p>

          <h2 className="mt-4 text-lg font-semibold text-navex-ink">
            {t("accueil.titre", { role: t(`roles.${utilisateur.role}`) })}
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
