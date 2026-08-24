"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ApiError, COOKIE_ACCES, seConnecter } from "@/lib/api-client";
import { LanguageSwitcher } from "@/components/language-switcher";

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
    <main className="flex min-h-dvh flex-col items-center justify-center bg-navex-stone px-4">
      <div className="w-full max-w-md space-y-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/navex-logo.png" alt="Navex" className="mx-auto h-10 w-auto" />

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
          <h1 className="text-lg font-semibold text-navex-ink">{t("login.titre")}</h1>
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
                className="mt-1.5 block w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm shadow-sm transition-colors placeholder:text-neutral-400 focus:border-navex-ink focus:outline-none focus:ring-1 focus:ring-navex-ink"
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
                className="mt-1.5 block w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm shadow-sm transition-colors placeholder:text-neutral-400 focus:border-navex-ink focus:outline-none focus:ring-1 focus:ring-navex-ink"
              />
            </div>

            {erreur && (
              <p role="alert" className="rounded-lg bg-navex-red-soft px-3 py-2 text-sm text-navex-red-dark">
                {erreur}
              </p>
            )}

            <button
              type="submit"
              disabled={enCours}
              className="w-full rounded-full bg-navex-red px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navex-red-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enCours ? t("commun.chargement") : t("login.valider")}
            </button>
          </form>
        </div>

        {/* Champ e-mail en LTR même en arabe — les identifiants restent lisibles */}
        <p className="text-center text-xs text-neutral-400" dir="ltr">
          admin@navex.dz · Test@1234
        </p>
        <div className="flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </main>
  );
}
