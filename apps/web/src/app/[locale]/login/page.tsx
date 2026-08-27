"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ApiError, COOKIE_ACCES, seConnecter } from "@/lib/api-client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Bouton } from "@/components/bouton";

export default function LoginPage() {
  const t = useTranslations();
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  function traduireErreur(code?: string): string {
    switch (code) {
      case "erreurs.identifiants_invalides":
        return t("erreurs.identifiants_invalides");
      case "erreurs.session_expiree":
        return t("erreurs.session_expiree");
      case "erreurs.acces_refuse":
        return t("erreurs.acces_refuse");
      default:
        return t("erreurs.generique");
    }
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    try {
      const resultat = await seConnecter(email, motDePasse);
      localStorage.setItem("navex_access_token", resultat.access_token);
      document.cookie = `${COOKIE_ACCES}=${resultat.access_token}; path=/; max-age=900; samesite=lax`;
      window.location.assign(`/${locale}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setErreur(err.message === "network" ? t("erreurs.reseau") : traduireErreur(err.code));
      } else {
        setErreur(t("erreurs.generique"));
      }
    } finally {
      setEnCours(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-ambient px-4">
      {/* Éléments décoratifs ambiants */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -start-20 -top-20 h-72 w-72 rounded-full bg-navex-red/5 blur-3xl" />
        <div className="absolute -bottom-32 -end-32 h-96 w-96 rounded-full bg-navex-red/3 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md space-y-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/navex-logo.png" alt="Navex" className="mx-auto h-10 w-auto animate-fade-in" />

        <div className="card-glass-solid rounded-3xl p-8 animate-slide-up">
          <h1 className="text-lg font-bold text-navex-ink">{t("login.titre")}</h1>
          <p className="mt-1 text-sm text-neutral-500">{t("login.soustitre")}</p>

          <form onSubmit={soumettre} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-navex-ink">
                {t("login.email")}
              </label>
              <input
                id="email"
                type="email"
                dir="ltr"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 block w-full rounded-2xl border border-neutral-200/80 bg-white/60 px-4 py-3 text-sm shadow-soft transition-all placeholder:text-neutral-400 focus:border-navex-red/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navex-red/10"
              />
            </div>

            <div>
              <label htmlFor="mot_de_passe" className="block text-sm font-medium text-navex-ink">
                {t("login.mot_de_passe")}
              </label>
              <input
                id="mot_de_passe"
                type="password"
                required
                minLength={8}
                autoComplete="current-password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                className="mt-1.5 block w-full rounded-2xl border border-neutral-200/80 bg-white/60 px-4 py-3 text-sm shadow-soft transition-all placeholder:text-neutral-400 focus:border-navex-red/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navex-red/10"
              />
            </div>

            {erreur && (
              <p role="alert" className="rounded-2xl bg-navex-red-soft/80 px-4 py-2.5 text-sm text-navex-red-dark backdrop-blur-sm">
                {erreur}
              </p>
            )}

            <Bouton type="submit" disabled={enCours} className="w-full" variante="primaire">
              {enCours ? t("commun.chargement") : t("login.valider")}
            </Bouton>
          </form>
        </div>

        <div className="flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </main>
  );
}
