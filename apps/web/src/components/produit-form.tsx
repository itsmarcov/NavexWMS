"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AjouterCataloguePayload, CatalogueProduitDTO } from "@/lib/api-client";
import { Bouton } from "@/components/bouton";

const SKU_PATTERN = /^SKU-\d+$/;

type FormChamp = {
  sku_code: string;
  designation: string;
  longueur_cm: string;
  largeur_cm: string;
  hauteur_cm: string;
  poids_kg: string;
  fragile: boolean;
  type_emballage: "carton" | "palette" | "sac" | "autre";
  photo_url: string;
  categorie: string;
};

type ErreurChamp = Partial<Record<keyof FormChamp, string>>;

function deDtoVersForm(v: Partial<CatalogueProduitDTO>): FormChamp {
  return {
    sku_code: v.sku_code ?? "",
    designation: v.designation ?? "",
    longueur_cm: v.longueur_cm != null ? String(v.longueur_cm) : "",
    largeur_cm: v.largeur_cm != null ? String(v.largeur_cm) : "",
    hauteur_cm: v.hauteur_cm != null ? String(v.hauteur_cm) : "",
    poids_kg: v.poids_kg != null ? String(v.poids_kg) : "",
    fragile: v.fragile ?? false,
    type_emballage: v.type_emballage ?? "carton",
    photo_url: v.photo_url ?? "",
    categorie: v.categorie ?? "",
  };
}

const CHAMPS_REQUIS: Array<keyof FormChamp> = [
  "sku_code", "designation", "longueur_cm", "largeur_cm", "hauteur_cm", "poids_kg",
];

function validerChamp(champ: keyof FormChamp, valeur: unknown, t: (k: string) => string): string | null {
  switch (champ) {
    case "sku_code": {
      if (typeof valeur !== "string" || valeur.trim().length === 0) return t("wizard.err_requis");
      if (!SKU_PATTERN.test(valeur.trim())) return t("sku_format");
      return null;
    }
    case "designation":
      return typeof valeur === "string" && valeur.trim().length > 0 ? null : t("wizard.err_requis");
    case "longueur_cm":
    case "largeur_cm":
    case "hauteur_cm":
      return Number(valeur) > 0 ? null : t("wizard.err_superieur_0");
    case "poids_kg":
      return Number(valeur) > 0 ? null : t("wizard.err_superieur_0");
    default:
      return null;
  }
}

function valider(p: FormChamp, t: (k: string) => string): ErreurChamp {
  const e: ErreurChamp = {};
  for (const champ of CHAMPS_REQUIS) {
    const err = validerChamp(champ, p[champ], t);
    if (err) e[champ] = err;
  }
  return e;
}

const CHAMP_CLASSE =
  "mt-1 block w-full rounded-2xl border border-neutral-200/80 bg-white/60 px-4 py-2.5 text-sm shadow-soft transition-all placeholder:text-neutral-400 focus:border-navex-red/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navex-red/10";

const CHAMP_CLASSE_ERREUR =
  "mt-1 block w-full rounded-2xl border border-navex-red bg-white/60 px-4 py-2.5 text-sm shadow-soft transition-all placeholder:text-neutral-400 focus:border-navex-red focus:bg-white focus:outline-none focus:ring-2 focus:ring-navex-red/20";

type Props = {
  initialValues?: Partial<CatalogueProduitDTO>;
  onSubmit: (dto: AjouterCataloguePayload) => Promise<void>;
  submitLabel: string;
  onCancel: () => void;
};

export function ProduitForm({ initialValues, onSubmit, submitLabel, onCancel }: Props) {
  const t = useTranslations();
  const estEdition = !!initialValues?.id;
  const [form, setForm] = useState<FormChamp>(() => deDtoVersForm(initialValues ?? {}));
  const [erreurs, setErreurs] = useState<ErreurChamp>({});
  const [enCours, setEnCours] = useState(false);

  function maj<K extends keyof FormChamp>(cle: K, valeur: FormChamp[K]) {
    setForm((f) => ({ ...f, [cle]: valeur }));
    const err = validerChamp(cle, valeur, t);
    if (!err) setErreurs((e) => { const c = { ...e }; delete c[cle]; return c; });
  }

  async function soumettre() {
    const errs = valider(form, t);
    const nbErreurs = Object.keys(errs).length;
    if (nbErreurs > 0) {
      setErreurs(errs);
      return;
    }
    setEnCours(true);
    try {
      await onSubmit({
        sku_code: form.sku_code.trim(),
        designation: form.designation.trim(),
        longueur_cm: Number(form.longueur_cm),
        largeur_cm: Number(form.largeur_cm),
        hauteur_cm: Number(form.hauteur_cm),
        poids_kg: Number(form.poids_kg),
        fragile: form.fragile,
        type_emballage: form.type_emballage,
        photo_url: form.photo_url.trim() || null,
        categorie: form.categorie.trim() || null,
      });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-navex-ink">
          {t("catalogue.sku")}
          <input
            dir="ltr"
            readOnly={estEdition}
            value={form.sku_code}
            onChange={(e) => maj("sku_code", e.target.value)}
            className={erreurs.sku_code ? CHAMP_CLASSE_ERREUR : CHAMP_CLASSE}
          />
          {erreurs.sku_code && <span className="mt-0.5 block text-xs text-navex-red">{erreurs.sku_code}</span>}
        </label>
        <label className="block text-sm font-medium text-navex-ink">
          {t("catalogue.designation")}
          <input
            value={form.designation}
            onChange={(e) => maj("designation", e.target.value)}
            className={erreurs.designation ? CHAMP_CLASSE_ERREUR : CHAMP_CLASSE}
          />
          {erreurs.designation && <span className="mt-0.5 block text-xs text-navex-red">{erreurs.designation}</span>}
        </label>
        <label className="block text-sm font-medium text-navex-ink">
          {t("catalogue.longueur")}
          <input
            type="number" min="0.1" step="0.1" dir="ltr"
            value={form.longueur_cm}
            onChange={(e) => maj("longueur_cm", e.target.value)}
            className={erreurs.longueur_cm ? CHAMP_CLASSE_ERREUR : CHAMP_CLASSE}
          />
          {erreurs.longueur_cm && <span className="mt-0.5 block text-xs text-navex-red">{erreurs.longueur_cm}</span>}
        </label>
        <label className="block text-sm font-medium text-navex-ink">
          {t("catalogue.largeur")}
          <input
            type="number" min="0.1" step="0.1" dir="ltr"
            value={form.largeur_cm}
            onChange={(e) => maj("largeur_cm", e.target.value)}
            className={erreurs.largeur_cm ? CHAMP_CLASSE_ERREUR : CHAMP_CLASSE}
          />
          {erreurs.largeur_cm && <span className="mt-0.5 block text-xs text-navex-red">{erreurs.largeur_cm}</span>}
        </label>
        <label className="block text-sm font-medium text-navex-ink">
          {t("catalogue.hauteur")}
          <input
            type="number" min="0.1" step="0.1" dir="ltr"
            value={form.hauteur_cm}
            onChange={(e) => maj("hauteur_cm", e.target.value)}
            className={erreurs.hauteur_cm ? CHAMP_CLASSE_ERREUR : CHAMP_CLASSE}
          />
          {erreurs.hauteur_cm && <span className="mt-0.5 block text-xs text-navex-red">{erreurs.hauteur_cm}</span>}
        </label>
        <label className="block text-sm font-medium text-navex-ink">
          {t("catalogue.poids_kg")}
          <input
            type="number" min="0.01" step="0.01" dir="ltr"
            value={form.poids_kg}
            onChange={(e) => maj("poids_kg", e.target.value)}
            className={erreurs.poids_kg ? CHAMP_CLASSE_ERREUR : CHAMP_CLASSE}
          />
          {erreurs.poids_kg && <span className="mt-0.5 block text-xs text-navex-red">{erreurs.poids_kg}</span>}
        </label>
        <label className="block text-sm font-medium text-navex-ink">
          {t("catalogue.type_emballage")}
          <select value={form.type_emballage} onChange={(e) => maj("type_emballage", e.target.value as FormChamp["type_emballage"])} className={CHAMP_CLASSE}>
            <option value="carton">{t("produit.emballage_carton")}</option>
            <option value="palette">{t("produit.emballage_palette")}</option>
            <option value="sac">{t("produit.emballage_sac")}</option>
            <option value="autre">{t("produit.emballage_autre")}</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-navex-ink">
          {t("catalogue.photo_url")}
          <input
            value={form.photo_url}
            onChange={(e) => maj("photo_url", e.target.value)}
            className={CHAMP_CLASSE}
          />
        </label>
        <label className="block text-sm font-medium text-navex-ink">
          {t("catalogue.categorie_label")}
          <input
            value={form.categorie}
            onChange={(e) => maj("categorie", e.target.value)}
            className={CHAMP_CLASSE}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-navex-ink">
        <input
          type="checkbox"
          checked={form.fragile}
          onChange={(e) => maj("fragile", e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300"
        />
        {t("catalogue.fragile")}
      </label>
      <div className="flex justify-end gap-3 pt-2">
        <Bouton variante="secondaire" onClick={onCancel}>
          {t("catalogue.annuler")}
        </Bouton>
        <Bouton variante="primaire" onClick={soumettre} disabled={enCours}>
          {enCours ? "…" : submitLabel}
        </Bouton>
      </div>
    </div>
  );
}
