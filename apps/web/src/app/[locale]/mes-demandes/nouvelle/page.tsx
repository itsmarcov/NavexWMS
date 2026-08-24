"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { NouveauProduit, TypeEmballageDTO } from "@navex/contracts";
import { creerDemande, uploaderPhoto } from "@/lib/api-client";
import { messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";

interface ProduitForm {
  sku_code: string;
  designation: string;
  longueur_cm: string;
  largeur_cm: string;
  hauteur_cm: string;
  poids_kg: string;
  fragile: boolean;
  type_emballage: TypeEmballageDTO;
  quantite: string;
  photo_url: string | null;
  photo_nom?: string;
}

const PRODUIT_VIDE: ProduitForm = {
  sku_code: "",
  designation: "",
  longueur_cm: "",
  largeur_cm: "",
  hauteur_cm: "",
  poids_kg: "",
  fragile: false,
  type_emballage: "carton",
  quantite: "1",
  photo_url: null,
};

function produitComplet(p: ProduitForm): boolean {
  return (
    p.sku_code.trim().length > 0 &&
    p.designation.trim().length > 0 &&
    Number(p.longueur_cm) > 0 &&
    Number(p.largeur_cm) > 0 &&
    Number(p.hauteur_cm) > 0 &&
    Number(p.poids_kg) > 0 &&
    Number(p.quantite) >= 1
  );
}

export default function PageNouvelleDemande() {
  const t = useTranslations();
  const tProduit = useTranslations("produit");
  const locale = useLocale();

  const [etape, setEtape] = useState(0);
  const [produits, setProduits] = useState<ProduitForm[]>([{ ...PRODUIT_VIDE }]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enEnvoi, setEnEnvoi] = useState(false);
  const [referenceCreee, setReferenceCreee] = useState<string | null>(null);

  const etapes = [t("wizard.etape_produits"), t("wizard.etape_recapitulatif"), t("wizard.etape_envoi")];

  function majProduit(index: number, changement: Partial<ProduitForm>) {
    setProduits((anciens) => anciens.map((p, i) => (i === index ? { ...p, ...changement } : p)));
  }

  async function televerserPhoto(index: number, fichier: File) {
    setErreur(null);
    majProduit(index, { photo_nom: fichier.name });
    try {
      const { url } = await uploaderPhoto(fichier);
      majProduit(index, { photo_url: url });
    } catch (e) {
      setErreur(messageErreur(t, e));
      majProduit(index, { photo_nom: undefined, photo_url: null });
    }
  }

  function etapeSuivante() {
    if (etape === 0) {
      if (produits.length === 0 || !produits.every(produitComplet)) {
        setErreur(t("erreurs.champs_manquants"));
        return;
      }
    }
    setErreur(null);
    setEtape((e) => e + 1);
  }

  async function envoyer() {
    setErreur(null);
    setEnEnvoi(true);
    try {
      const charge: NouveauProduit[] = produits.map((p) => ({
        sku_code: p.sku_code.trim(),
        designation: p.designation.trim(),
        longueur_cm: Number(p.longueur_cm),
        largeur_cm: Number(p.largeur_cm),
        hauteur_cm: Number(p.hauteur_cm),
        poids_kg: Number(p.poids_kg),
        fragile: p.fragile,
        type_emballage: p.type_emballage,
        quantite: Number(p.quantite),
        photo_url: p.photo_url,
      }));
      const creee = await creerDemande(charge);
      setReferenceCreee(creee.reference);
      setEtape(2);
    } catch (e) {
      setErreur(messageErreur(t, e));
    } finally {
      setEnEnvoi(false);
    }
  }

  const totalColis = produits.reduce((somme, p) => somme + (Number(p.quantite) || 0), 0);
  const totalPoids = produits.reduce((somme, p) => somme + (Number(p.poids_kg) || 0) * (Number(p.quantite) || 0), 0);

  const champClasse =
    "mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-neutral-400 focus:border-navex-ink focus:outline-none focus:ring-1 focus:ring-navex-ink";

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <h1 className="text-xl font-bold text-navex-ink">{t("wizard.titre")}</h1>

        {/* Indicateur d'étapes */}
        <ol className="flex items-center gap-2">
          {etapes.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  i <= etape ? "bg-navex-red text-white" : "bg-navex-stone text-neutral-500"
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-xs ${i <= etape ? "font-semibold text-navex-ink" : "text-neutral-400"}`}>
                {label}
              </span>
              {i < etapes.length - 1 && <span className="h-px flex-1 bg-neutral-200" />}
            </li>
          ))}
        </ol>

        {erreur && (
          <p role="alert" className="rounded-lg bg-navex-red-soft px-3 py-2 text-sm text-navex-red-dark">
            {erreur}
          </p>
        )}

        {/* Étape 1 : produits */}
        {etape === 0 && (
          <section className="space-y-4">
            {produits.map((p, index) => (
              <article key={index} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-navex-ink">{tProduit("carte", { n: index + 1 })}</h2>
                  {produits.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setProduits((anciens) => anciens.filter((_, i) => i !== index))}
                      className="text-xs font-medium text-navex-red hover:text-navex-red-dark"
                    >
                      {t("wizard.supprimer_produit")}
                    </button>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-navex-ink">
                    {tProduit("sku")}
                    <input dir="ltr" value={p.sku_code} onChange={(e) => majProduit(index, { sku_code: e.target.value })} className={champClasse} />
                  </label>
                  <label className="block text-sm font-medium text-navex-ink">
                    {tProduit("designation")}
                    <input value={p.designation} onChange={(e) => majProduit(index, { designation: e.target.value })} className={champClasse} />
                  </label>
                  <label className="block text-sm font-medium text-navex-ink">
                    {tProduit("longueur")}
                    <input type="number" min="0.1" step="0.1" dir="ltr" value={p.longueur_cm} onChange={(e) => majProduit(index, { longueur_cm: e.target.value })} className={champClasse} />
                  </label>
                  <label className="block text-sm font-medium text-navex-ink">
                    {tProduit("largeur")}
                    <input type="number" min="0.1" step="0.1" dir="ltr" value={p.largeur_cm} onChange={(e) => majProduit(index, { largeur_cm: e.target.value })} className={champClasse} />
                  </label>
                  <label className="block text-sm font-medium text-navex-ink">
                    {tProduit("hauteur")}
                    <input type="number" min="0.1" step="0.1" dir="ltr" value={p.hauteur_cm} onChange={(e) => majProduit(index, { hauteur_cm: e.target.value })} className={champClasse} />
                  </label>
                  <label className="block text-sm font-medium text-navex-ink">
                    {tProduit("poids")}
                    <input type="number" min="0.01" step="0.01" dir="ltr" value={p.poids_kg} onChange={(e) => majProduit(index, { poids_kg: e.target.value })} className={champClasse} />
                  </label>
                  <label className="block text-sm font-medium text-navex-ink">
                    {tProduit("type_emballage")}
                    <select value={p.type_emballage} onChange={(e) => majProduit(index, { type_emballage: e.target.value as TypeEmballageDTO })} className={champClasse}>
                      <option value="carton">{tProduit("emballage_carton")}</option>
                      <option value="palette">{tProduit("emballage_palette")}</option>
                      <option value="sac">{tProduit("emballage_sac")}</option>
                      <option value="autre">{tProduit("emballage_autre")}</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-navex-ink">
                    {tProduit("quantite")}
                    <input type="number" min="1" step="1" dir="ltr" value={p.quantite} onChange={(e) => majProduit(index, { quantite: e.target.value })} className={champClasse} />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-navex-ink">
                    <input
                      type="checkbox"
                      checked={p.fragile}
                      onChange={(e) => majProduit(index, { fragile: e.target.checked })}
                      className="h-4 w-4 rounded border-neutral-300"
                    />
                    {tProduit("fragile")}
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-navex-ink">{tProduit("photo")}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void televerserPhoto(index, f);
                      }}
                      className="text-xs text-neutral-500 file:me-2 file:rounded-full file:border-0 file:bg-navex-red-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-navex-red-dark hover:file:bg-navex-red/20"
                    />
                    {p.photo_nom && (
                      <span className="text-xs text-navex-ink">
                        {p.photo_url ? tProduit("photo_ok") : `${tProduit("photo_envoi")} (${p.photo_nom})`}
                      </span>
                    )}
                  </label>
                </div>
              </article>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setProduits((anciens) => [...anciens, { ...PRODUIT_VIDE }])}
                className="rounded-full border border-dashed border-neutral-400 px-4 py-2 text-sm font-medium text-navex-ink transition-colors hover:border-navex-ink"
              >
                {t("wizard.ajouter_produit")}
              </button>
              <button
                type="button"
                onClick={etapeSuivante}
                className="rounded-full bg-navex-red px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-navex-red-dark"
              >
                {t("wizard.suivant")}
              </button>
            </div>
          </section>
        )}

        {/* Étape 2 : récapitulatif */}
        {etape === 1 && (
          <section className="space-y-4">
            <div className="overflow-x-auto rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-start text-xs uppercase text-neutral-500">
                    <th className="py-2 text-start">{t("produit.sku")}</th>
                    <th className="py-2 text-start">{t("produit.designation")}</th>
                    <th className="py-2 text-end">{t("produit.dimensions_court")}</th>
                    <th className="py-2 text-end">{t("produit.poids")}</th>
                    <th className="py-2 text-end">{t("produit.quantite")}</th>
                  </tr>
                </thead>
                <tbody>
                  {produits.map((p, i) => (
                    <tr key={i} className="border-b border-neutral-100">
                      <td className="py-2 text-navex-ink" dir="ltr">
                        {p.sku_code}
                      </td>
                      <td className="py-2 text-navex-ink">
                        {p.designation} {p.fragile && <span title="">⚠</span>}
                      </td>
                      <td className="py-2 text-end text-navex-ink" dir="ltr">
                        {Number(p.longueur_cm)}×{Number(p.largeur_cm)}×{Number(p.hauteur_cm)}
                      </td>
                      <td className="py-2 text-end text-navex-ink" dir="ltr">
                        {Number(p.poids_kg)}
                      </td>
                      <td className="py-2 text-end text-navex-ink" dir="ltr">
                        {Number(p.quantite)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-neutral-600">
              {t("wizard.recap_total_colis", { total: totalColis })} ·{" "}
              {t("wizard.recap_total_poids", { total: totalPoids.toFixed(2) })}
            </p>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setEtape(0)}
                className="rounded-full border border-navex-ink px-4 py-2 text-sm font-medium text-navex-ink transition-colors hover:bg-navex-stone"
              >
                {t("wizard.precedent")}
              </button>
              <button
                type="button"
                onClick={etapeSuivante}
                className="rounded-full bg-navex-red px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-navex-red-dark"
              >
                {t("wizard.suivant")}
              </button>
            </div>
          </section>
        )}

        {/* Étape 3 : envoi / confirmation */}
        {etape === 2 && (
          <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-neutral-200">
            {referenceCreee ? (
              <div className="space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-navex-red text-2xl text-white">
                  ✓
                </div>
                <p className="text-sm text-navex-ink">
                  {t("wizard.succes", { reference: referenceCreee })}
                </p>
                <a
                  href="/mes-demandes"
                  className="inline-block rounded-full bg-navex-red px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-navex-red-dark"
                >
                  {t("nav.mes_demandes")}
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-navex-ink">
                  {enEnvoi ? t("wizard.envoi_cours") : t("wizard.recap_vide")}
                </p>
                {!enEnvoi && (
                  <button
                    type="button"
                    onClick={envoyer}
                    className="rounded-full bg-navex-red px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-navex-red-dark"
                  >
                    {t("wizard.envoyer")}
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        <p className="text-start">
          <Link href="/mes-demandes" className="text-xs text-neutral-500 underline hover:text-navex-ink">
            ← {t("commun.retour")}
          </Link>
        </p>
      </main>
    </div>
  );
}
