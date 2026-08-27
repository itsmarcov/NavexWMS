"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { UtilisateurDTO } from "@navex/contracts";
import { Link, usePathname } from "@/i18n/navigation";
import { seDeconnecter, utilisateurCourant } from "@/lib/api-client";
import { Bouton } from "@/components/bouton";
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
    const label = (utilisateur.role === "admin" || utilisateur.role === "agent_commercial")
      ? t("nav.demandes")
      : t("nav.mes_demandes");
    liens.push({ href: "/mes-demandes", label });
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
    <header className="sticky top-0 z-40 border-b border-white/40 bg-white/60 backdrop-blur-xl backdrop-saturate-180 supports-[backdrop-filter]:bg-white/50">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
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
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                    actif
                      ? "bg-navex-red text-white shadow-glow-red"
                      : "text-navex-ink/70 hover:bg-navex-red-soft/60 hover:text-navex-red"
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
          <Bouton variante="secondaire" onClick={deconnexion} aria-label={t("commun.se_deconnecter")}>
            {t("commun.se_deconnecter")}
          </Bouton>
        </div>
      </div>
    </header>
  );
}
