"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Role, UtilisateurDTO } from "@navex/contracts";
import { Link, usePathname } from "@/i18n/navigation";
import { seDeconnecter, utilisateurCourant } from "@/lib/api-client";
import { Bouton } from "@/components/bouton";
import { LanguageSwitcher } from "@/components/language-switcher";

export function AppHeader() {
  const t = useTranslations();
  const tTour = useTranslations("tour");
  const locale = useLocale();
  const pathname = usePathname();
  const [utilisateur, setUtilisateur] = useState<UtilisateurDTO | null>(null);
  const [menuOuvert, setMenuOuvert] = useState(false);

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
  if (utilisateur && utilisateur.role === "expediteur") {
    liens.push({ href: "/catalogue", label: t("nav.catalogue") });
  }
  if (utilisateur && (utilisateur.role === "agent_commercial" || utilisateur.role === "admin")) {
    liens.push({ href: "/file-attente", label: t("nav.file_attente") });
  }
  if (utilisateur && (utilisateur.role === "agent_entrepot" || utilisateur.role === "admin")) {
    liens.push({ href: "/entrepot", label: t("nav.entrepot") });
  }
  if (utilisateur && (utilisateur.role === "agent_station" || utilisateur.role === "admin")) {
    liens.push({ href: "/station", label: t("nav.station") });
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
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex shrink-0 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/navex-logo.png" alt="Navex" className="h-8 w-auto" />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label={t("nav.principal")}>
            {liens.map((lien) => {
              const actif = lien.href === "/" ? pathname === "/" : pathname.startsWith(lien.href);
              return (
                <Link
                  key={lien.href}
                  href={lien.href}
                  data-tour={lien.href === "/mes-demandes" ? "nav-mes-demandes" : lien.href === "/admin" ? "nav-admin" : undefined}
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
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("navex:relancer-tour"))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-navex-red-soft text-sm font-bold text-navex-red-dark hover:bg-navex-red hover:text-white transition-colors"
            aria-label={tTour("relancer")}
            title={tTour("relancer")}
          >
            ?
          </button>
          <Bouton variante="secondaire" onClick={deconnexion} aria-label={t("commun.se_deconnecter")} className="hidden md:inline-flex">
            {t("commun.se_deconnecter")}
          </Bouton>
          <button
            className="inline-flex items-center justify-center rounded-lg p-2 text-navex-ink/70 hover:bg-navex-red-soft/60 hover:text-navex-red md:hidden"
            onClick={() => setMenuOuvert(!menuOuvert)}
            aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOuvert}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              {menuOuvert
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />}
            </svg>
          </button>
        </div>
      </div>
      {menuOuvert && (
        <nav className="border-t border-white/40 px-4 py-3 md:hidden" aria-label={t("nav.principal")}>
          <ul className="flex flex-col gap-1">
            {liens.map((lien) => {
              const actif = lien.href === "/" ? pathname === "/" : pathname.startsWith(lien.href);
              return (
                <li key={lien.href}>
                  <Link
                    href={lien.href}
                    onClick={() => setMenuOuvert(false)}
                    className={`block rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      actif
                        ? "bg-navex-red text-white"
                        : "text-navex-ink/70 hover:bg-navex-red-soft/60 hover:text-navex-red"
                    }`}
                  >
                    {lien.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <button onClick={deconnexion} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-navex-red hover:bg-navex-red-soft/60">
                {t("commun.se_deconnecter")}
              </button>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
