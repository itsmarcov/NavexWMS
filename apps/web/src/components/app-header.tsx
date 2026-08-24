"use client";

import Image from "next/image";
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
  if (utilisateur && utilisateur.role === "admin") {
    liens.push({ href: "/admin", label: t("nav.admin") });
  }

  async function deconnexion() {
    await seDeconnecter();
    window.location.assign(`/${locale}/login`);
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3">
      <div className="flex items-center gap-5">
        <Link href="/" className="flex shrink-0 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/navex-logo.png" alt="Navex" className="h-8 w-auto" />
        </Link>
        <nav className="flex items-center gap-1">
          {liens.map((lien) => {
            const actif = pathname === lien.href;
            return (
              <Link
                key={lien.href}
                href={lien.href}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  actif
                    ? "bg-navex-red text-white"
                    : "text-navex-ink hover:bg-navex-red-soft hover:text-navex-red"
                }`}
              >
                {lien.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <button
          onClick={deconnexion}
          className="rounded-full border border-navex-ink px-3 py-1.5 text-sm font-medium text-navex-ink transition-colors hover:bg-navex-stone"
        >
          {t("commun.se_deconnecter")}
        </button>
      </div>
    </header>
  );
}
