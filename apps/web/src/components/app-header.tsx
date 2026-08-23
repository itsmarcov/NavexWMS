"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { UtilisateurDTO } from "@navex/contracts";
import { Link, usePathname } from "@/i18n/navigation";
import { seDeconnecter, utilisateurCourant } from "@/lib/api-client";
import { LanguageSwitcher } from "@/components/language-switcher";

export function AppHeader() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const [utilisateur, setUtilisateur] = useState<UtilisateurDTO | null>(null);

  useEffect(() => {
    utilisateurCourant().then(setUtilisateur).catch(() => undefined);
  }, []);

  const liens: Array<{ href: string; label: string }> = [{ href: "/", label: t("nav.accueil") }];
  if (utilisateur && utilisateur.role !== "agent_entrepot") {
    liens.push({ href: "/mes-demandes", label: t("nav.mes_demandes") });
  }
  if (utilisateur && (utilisateur.role === "agent_commercial" || utilisateur.role === "admin")) {
    liens.push({ href: "/file-attente", label: t("nav.file_attente") });
  }
  if (utilisateur && (utilisateur.role === "agent_entrepot" || utilisateur.role === "admin")) {
    liens.push({ href: "/entrepot", label: t("nav.entrepot") });
  }

  async function deconnexion() {
    await seDeconnecter();
    window.location.assign(`/${locale}/login`);
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-lg font-bold text-neutral-900">
          {t("commun.nom_app")}
        </Link>
        <nav className="flex items-center gap-1">
          {liens.map((lien) => (
            <Link
              key={lien.href}
              href={lien.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                pathname === lien.href
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              }`}
            >
              {lien.label}
            </Link>
          ))}
        </nav>
      </div>
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
  );
}
