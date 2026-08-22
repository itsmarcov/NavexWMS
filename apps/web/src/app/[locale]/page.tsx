"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { UtilisateurDTO } from "@navex/contracts";
import { seDeconnecter, utilisateurCourant } from "@/lib/api-client";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "@/i18n/navigation";

export default function PageAccueil() {
  const t = useTranslations();
  const locale = useLocale();

  const [utilisateur, setUtilisateur] = useState<UtilisateurDTO | null>(null);
  const [charge, setCharge] = useState(true);

  useEffect(() => {
    utilisateurCourant()
      .then(setUtilisateur)
      .catch(() => window.location.assign(`/${locale}/login`))
      .finally(() => setCharge(false));
  }, [locale]);

  if (charge || !utilisateur) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-neutral-500">{t("commun.chargement")}</p>
      </main>
    );
  }

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-500">{t("accueil.session")}</p>
          <p className="mt-1 font-medium" dir="ltr">
            {utilisateur.email}
          </p>

          <h2 className="mt-4 text-lg font-semibold">
            {t("accueil.titre", { role: t(`roles.${utilisateur.role}`) })}
          </h2>

          <p className="mt-4 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
            {t("accueil.phase_en_cours")}
          </p>

          {utilisateur.role !== "agent_entrepot" && (
            <Link
              href="/mes-demandes"
              className="mt-5 inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
            >
              {t("nav.mes_demandes")}
            </Link>
          )}

          {/* Démonstration des badges de statut (couleurs cohérentes transverses) */}
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
