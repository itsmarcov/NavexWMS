"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { UtilisateurDTO } from "@navex/contracts";
import { seDeconnecter, utilisateurCourant } from "@/lib/api-client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { StatusBadge } from "@/components/status-badge";

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

  async function deconnexion() {
    await seDeconnecter();
    window.location.assign(`/${locale}/login`);
  }

  if (charge || !utilisateur) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-neutral-500">{t("commun.chargement")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("commun.nom_app")}</h1>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <button
            onClick={deconnexion}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
          >
            {t("commun.se_deconnecter")}
          </button>
        </div>
      </header>

      <section className="mt-10 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
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

        {/* Démonstration des badges de statut (couleurs cohérentes transverses) */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <StatusBadge statut="en_attente" />
          <StatusBadge statut="approuve" />
          <StatusBadge statut="refuse" />
        </div>
      </section>
    </main>
  );
}
