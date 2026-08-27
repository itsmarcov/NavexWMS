"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { NouveauProduit, TypeEmballageDTO } from "@navex/contracts";
import { ajouterCatalogue, creerDemande, listerCatalogue, uploaderPhoto, type CatalogueProduitDTO } from "@/lib/api-client";
import { messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";
import { RequireRole } from "@/components/require-role";
import { Bouton } from "@/components/bouton";

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
  volume_expedition_journalier: string;
  volume_expedition_mensuel: string;
}

type ErreurProduit = Partial<Record<keyof ProduitForm, string>>;

const PRODUIT_VIDE: ProduitForm = {
  sku_code: "", designation: "", longueur_cm: "", largeur_cm: "",
  hauteur_cm: "", poids_kg: "", fragile: false, type_emballage: "carton",
  quantite: "1", photo_url: null,
  volume_expedition_journalier: "", volume_expedition_mensuel: "",
};

const SKU_PATTERN = /^SKU-\d+$/;

function produitComplet(p: ProduitForm): boolean {
  return (
    p.sku_code.trim().length > 0 && p.designation.trim().length > 0 &&
    Number(p.longueur_cm) > 0 && Number(p.largeur_cm) > 0 &&
    Number(p.hauteur_cm) > 0 && Number(p.poids_kg) > 0 && Number(p.quantite) >= 1
  );
}

const CHAMPS_REQUIS: Array<keyof ProduitForm> = ["sku_code", "designation", "longueur_cm", "largeur_cm", "hauteur_cm", "poids_kg", "quantite"];

function validerChamp(champ: keyof ProduitForm, valeur: unknown): string | null {
  switch (champ) {
    case "sku_code": {
      if (typeof valeur !== "string" || valeur.trim().length === 0) return "wizard.err_requis";
      if (!SKU_PATTERN.test(valeur.trim())) return "sku_format";
      return null;
    }
    case "designation": return (typeof valeur === "string" && valeur.trim().length > 0) ? null : "wizard.err_requis";
    case "longueur_cm": return Number(valeur) > 0 ? null : "wizard.err_superieur_0";
    case "largeur_cm":  return Number(valeur) > 0 ? null : "wizard.err_superieur_0";
    case "hauteur_cm":  return Number(valeur) > 0 ? null : "wizard.err_superieur_0";
    case "poids_kg":    return Number(valeur) > 0 ? null : "wizard.err_superieur_0";
    case "quantite":    return Number(valeur) >= 1 ? null : "wizard.err_min_1";
    default:            return null;
  }
}

function validerProduit(p: ProduitForm): ErreurProduit {
  const e: ErreurProduit = {};
  for (const champ of CHAMPS_REQUIS) {
    const err = validerChamp(champ, p[champ]);
    if (err) e[champ] = err;
  }
  return e;
}

export default function PageNouvelleDemande() {
  const t = useTranslations();
  const tProduit = useTranslations("produit");
  const locale = useLocale();
  const [etape, setEtape] = useState(0);
  const [produits, setProduits] = useState<ProduitForm[]>([{ ...PRODUIT_VIDE }]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreursParProduit, setErreursParProduit] = useState<Record<number, ErreurProduit>>({});
  const [uploadEnCours, setUploadEnCours] = useState<Record<number, boolean>>({});
  const [enEnvoi, setEnEnvoi] = useState(false);
  const [referenceCreee, setReferenceCreee] = useState<string | null>(null);
  const [conditionsAcceptee, setConditionsAcceptee] = useState(false);
  const [catalogue, setCatalogue] = useState<CatalogueProduitDTO[]>([]);
  const [catalogueSelection, setCatalogueSelection] = useState<Record<number, string>>({});

  useEffect(() => {
    listerCatalogue().then(setCatalogue).catch(() => undefined);
  }, []);

  const etapes = [t("wizard.etape_produits"), t("wizard.etape_recapitulatif"), t("wizard.etape_envoi")];

  function majProduit(index: number, changement: Partial<ProduitForm>) {
    setProduits((anciens) => anciens.map((p, i) => (i === index ? { ...p, ...changement } : p)));

    const champ = Object.keys(changement)[0] as keyof ProduitForm;
    const nouvelleValeur = changement[champ];
    if (champ && nouvelleValeur !== undefined && !validerChamp(champ, nouvelleValeur)) {
      setErreursParProduit((anciens) => {
        const copie = { ...anciens[index] };
        delete copie[champ];
        return { ...anciens, [index]: copie };
      });
    }
  }

  function appliquerCatalogue(index: number, entryId: string) {
    setCatalogueSelection((a) => ({ ...a, [index]: entryId }));
    const entry = catalogue.find((e) => e.id === entryId);
    if (!entry) return;
    majProduit(index, {
      sku_code: entry.sku_code,
      designation: entry.designation,
      longueur_cm: String(entry.longueur_cm),
      largeur_cm: String(entry.largeur_cm),
      hauteur_cm: String(entry.hauteur_cm),
      poids_kg: String(entry.poids_kg),
      type_emballage: entry.type_emballage as TypeEmballageDTO,
    });
  }

  async function televerserPhoto(index: number, fichier: File) {
    setErreur(null);
    majProduit(index, { photo_nom: fichier.name, photo_url: null });
    setUploadEnCours((a) => ({ ...a, [index]: true }));
    try {
      const { url } = await uploaderPhoto(fichier);
      majProduit(index, { photo_url: url });
    } catch (e) {
      setErreur(messageErreur(t, e));
      majProduit(index, { photo_nom: undefined, photo_url: null });
    } finally {
      setUploadEnCours((a) => ({ ...a, [index]: false }));
    }
  }

  function retirerPhoto(index: number) {
    majProduit(index, { photo_url: null, photo_nom: undefined });
  }

  function etapeSuivante() {
    if (etape !== 0) { setEtape((e) => e + 1); return; }

    const nouvellesErreurs: Record<number, ErreurProduit> = {};
    let premierChampIndex: number | null = null;
    let premierChampCle: string | null = null;

    produits.forEach((p, i) => {
      const errs = validerProduit(p);
      const cles = Object.keys(errs);
      if (cles.length > 0) {
        nouvellesErreurs[i] = errs;
        if (premierChampIndex === null) {
          premierChampIndex = i;
          premierChampCle = cles[0]!;
        }
      }
    });

    const total = Object.values(nouvellesErreurs).reduce((s, e) => s + Object.keys(e).length, 0);

    if (total > 0) {
      setErreursParProduit(nouvellesErreurs);
      setErreur(t("wizard.champs_erreurs", { nombre: total }));
      if (premierChampIndex !== null && premierChampCle !== null) {
        const el = document.querySelector<HTMLElement>(
          `[data-produit="${premierChampIndex}"][data-champ="${premierChampCle}"]`,
        );
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => el?.focus(), 350);
      }
      return;
    }

    setErreursParProduit({});
    setErreur(null);
    setEtape((e) => e + 1);
  }

  async function envoyer() {
    setErreur(null);
    setEnEnvoi(true);
    try {
      const charge: NouveauProduit[] = produits.map((p) => ({
        sku_code: p.sku_code.trim(), designation: p.designation.trim(),
        longueur_cm: Number(p.longueur_cm), largeur_cm: Number(p.largeur_cm),
        hauteur_cm: Number(p.hauteur_cm), poids_kg: Number(p.poids_kg),
        fragile: p.fragile, type_emballage: p.type_emballage,
        quantite: Number(p.quantite), photo_url: p.photo_url,
        volume_expedition_journalier: p.volume_expedition_journalier ? Number(p.volume_expedition_journalier) : null,
        volume_expedition_mensuel: p.volume_expedition_mensuel ? Number(p.volume_expedition_mensuel) : null,
      }));
      const creee = await creerDemande(charge, conditionsAcceptee);
      const skusExistants = new Set(catalogue.map((e) => e.sku_code));
      for (const p of produits) {
        const sku = p.sku_code.trim();
        if (sku && !skusExistants.has(sku)) {
          await ajouterCatalogue({
            sku_code: sku,
            designation: p.designation.trim(),
            longueur_cm: Number(p.longueur_cm),
            largeur_cm: Number(p.largeur_cm),
            hauteur_cm: Number(p.hauteur_cm),
            poids_kg: Number(p.poids_kg),
            type_emballage: p.type_emballage,
          }).catch(() => undefined);
        }
      }
      setReferenceCreee(creee.reference);
      setEtape(2);
    } catch (e) {
      setErreur(messageErreur(t, e));
    } finally {
      setEnEnvoi(false);
    }
  }

  const totalColis = produits.reduce((s, p) => s + (Number(p.quantite) || 0), 0);
  const totalPoids = produits.reduce((s, p) => s + (Number(p.poids_kg) || 0) * (Number(p.quantite) || 0), 0);
  function fmtVol(v: number) { return v === 0 ? "0" : v < 0.01 ? v.toExponential(1) : v < 1 ? v.toFixed(4) : v.toFixed(2); }
  const totalVolumeM3 = produits.reduce((s, p) => s + (Number(p.longueur_cm) * Number(p.largeur_cm) * Number(p.hauteur_cm) * (Number(p.quantite) || 0)) / 1_000_000, 0);

  const champClasse =
    "mt-1 block w-full rounded-2xl border border-neutral-200/80 bg-white/60 px-4 py-2.5 text-sm shadow-soft transition-all placeholder:text-neutral-400 focus:border-navex-red/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navex-red/10";
  const champClasseErreur =
    "mt-1 block w-full rounded-2xl border border-navex-red bg-white/60 px-4 py-2.5 text-sm shadow-soft transition-all placeholder:text-neutral-400 focus:border-navex-red focus:bg-white focus:outline-none focus:ring-2 focus:ring-navex-red/20";

  return (
    <RequireRole roles={["expediteur"]}>
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <h1 className="text-2xl font-extrabold text-navex-ink">{t("wizard.titre")}</h1>

        <ol className="flex items-center gap-2">
          {etapes.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                i <= etape ? "bg-navex-red text-white shadow-glow-red" : "bg-navex-stone text-neutral-400"
              }`}>
                {i + 1}
              </span>
              <span className={`text-xs ${i <= etape ? "font-semibold text-navex-ink" : "text-neutral-400"}`}>
                {label}
              </span>
              {i < etapes.length - 1 && <span className="h-px flex-1 bg-neutral-200/60" />}
            </li>
          ))}
        </ol>

        {erreur && (
          <p role="alert" className="rounded-2xl bg-navex-red-soft/80 px-4 py-2.5 text-sm text-navex-red-dark backdrop-blur-sm">
            {erreur}
          </p>
        )}

        {etape === 0 && (
          <section className="space-y-4">
            {catalogue.length > 0 && (
              <section className="card-glass rounded-3xl p-4">
                <label className="block text-sm font-medium text-navex-ink">{t("catalogue_selectionner")}</label>
                <select
                  value=""
                  onChange={(e) => {
                    const entryId = e.target.value;
                    const nextIndex = produits.length - 1;
                    const last = produits[nextIndex];
                    if (last && !produitComplet(last)) {
                      appliquerCatalogue(nextIndex, entryId);
                    } else {
                      const idx = produits.length;
                      setProduits((a) => [...a, { ...PRODUIT_VIDE }]);
                      setTimeout(() => appliquerCatalogue(idx, entryId), 0);
                    }
                    setCatalogueSelection((a) => ({ ...a, [produits.length]: entryId }));
                  }}
                  className={champClasse}
                >
                  <option value="">{t("catalogue_selectionner")}…</option>
                  {catalogue.map((e) => (
                    <option key={e.id} value={e.id}>{e.sku_code} — {e.designation}</option>
                  ))}
                </select>
              </section>
            )}

            {produits.map((p, index) => (
              <article key={index} className="card-glass-solid rounded-3xl p-6 animate-slide-up">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-navex-ink">{tProduit("carte", { n: index + 1 })}</h2>
                  {produits.length > 1 && (
                    <Bouton variante="secondaire" onClick={() => setProduits((a) => a.filter((_, i) => i !== index))} className="text-xs font-medium">
                      {t("wizard.supprimer_produit")}
                    </Bouton>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-navex-ink">{tProduit("sku")}
                    <input dir="ltr" data-produit={index} data-champ="sku_code" value={p.sku_code} onChange={(e) => majProduit(index, { sku_code: e.target.value })} className={erreursParProduit[index]?.sku_code ? champClasseErreur : champClasse} />
                    {erreursParProduit[index]?.sku_code && <span className="mt-0.5 block text-xs text-navex-red">{t(erreursParProduit[index].sku_code)}</span>}
                  </label>
                  <label className="block text-sm font-medium text-navex-ink">{tProduit("designation")}
                    <input data-produit={index} data-champ="designation" value={p.designation} onChange={(e) => majProduit(index, { designation: e.target.value })} className={erreursParProduit[index]?.designation ? champClasseErreur : champClasse} />
                    {erreursParProduit[index]?.designation && <span className="mt-0.5 block text-xs text-navex-red">{t(erreursParProduit[index].designation)}</span>}
                  </label>
                  <label className="block text-sm font-medium text-navex-ink">{tProduit("longueur")}
                    <input type="number" min="0.1" step="0.1" dir="ltr" data-produit={index} data-champ="longueur_cm" value={p.longueur_cm} onChange={(e) => majProduit(index, { longueur_cm: e.target.value })} className={erreursParProduit[index]?.longueur_cm ? champClasseErreur : champClasse} />
                    {erreursParProduit[index]?.longueur_cm && <span className="mt-0.5 block text-xs text-navex-red">{t(erreursParProduit[index].longueur_cm)}</span>}
                  </label>
                  <label className="block text-sm font-medium text-navex-ink">{tProduit("largeur")}
                    <input type="number" min="0.1" step="0.1" dir="ltr" data-produit={index} data-champ="largeur_cm" value={p.largeur_cm} onChange={(e) => majProduit(index, { largeur_cm: e.target.value })} className={erreursParProduit[index]?.largeur_cm ? champClasseErreur : champClasse} />
                    {erreursParProduit[index]?.largeur_cm && <span className="mt-0.5 block text-xs text-navex-red">{t(erreursParProduit[index].largeur_cm)}</span>}
                  </label>
                  <label className="block text-sm font-medium text-navex-ink">{tProduit("hauteur")}
                    <input type="number" min="0.1" step="0.1" dir="ltr" data-produit={index} data-champ="hauteur_cm" value={p.hauteur_cm} onChange={(e) => majProduit(index, { hauteur_cm: e.target.value })} className={erreursParProduit[index]?.hauteur_cm ? champClasseErreur : champClasse} />
                    {erreursParProduit[index]?.hauteur_cm && <span className="mt-0.5 block text-xs text-navex-red">{t(erreursParProduit[index].hauteur_cm)}</span>}
                  </label>
                  <label className="block text-sm font-medium text-navex-ink">{tProduit("poids")}
                    <input type="number" min="0.01" step="0.01" dir="ltr" data-produit={index} data-champ="poids_kg" value={p.poids_kg} onChange={(e) => majProduit(index, { poids_kg: e.target.value })} className={erreursParProduit[index]?.poids_kg ? champClasseErreur : champClasse} />
                    {erreursParProduit[index]?.poids_kg && <span className="mt-0.5 block text-xs text-navex-red">{t(erreursParProduit[index].poids_kg)}</span>}
                  </label>
                  <label className="block text-sm font-medium text-navex-ink">{tProduit("type_emballage")}
                    <select value={p.type_emballage} onChange={(e) => majProduit(index, { type_emballage: e.target.value as TypeEmballageDTO })} className={champClasse}>
                      <option value="carton">{tProduit("emballage_carton")}</option>
                      <option value="palette">{tProduit("emballage_palette")}</option>
                      <option value="sac">{tProduit("emballage_sac")}</option>
                      <option value="autre">{tProduit("emballage_autre")}</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-navex-ink">{tProduit("quantite")}
                    <input type="number" min="1" step="1" dir="ltr" data-produit={index} data-champ="quantite" value={p.quantite} onChange={(e) => majProduit(index, { quantite: e.target.value })} className={erreursParProduit[index]?.quantite ? champClasseErreur : champClasse} />
                    {erreursParProduit[index]?.quantite && <span className="mt-0.5 block text-xs text-navex-red">{t(erreursParProduit[index].quantite)}</span>}
                  </label>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-navex-ink">{t("volume_journalier")}
                    <input type="number" min="0" step="1" dir="ltr" value={p.volume_expedition_journalier} onChange={(e) => majProduit(index, { volume_expedition_journalier: e.target.value })} className={champClasse} />
                  </label>
                  <label className="block text-sm font-medium text-navex-ink">{t("volume_mensuel")}
                    <input type="number" min="0" step="1" dir="ltr" value={p.volume_expedition_mensuel} onChange={(e) => majProduit(index, { volume_expedition_mensuel: e.target.value })} className={champClasse} />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-navex-ink">
                    <input type="checkbox" checked={p.fragile} onChange={(e) => majProduit(index, { fragile: e.target.checked })} className="h-4 w-4 rounded border-neutral-300" />
                    {tProduit("fragile")}
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-navex-ink">{tProduit("photo")}</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void televerserPhoto(index, f); }}
                        className="text-xs text-neutral-500 file:me-2 file:rounded-full file:border-0 file:bg-navex-red-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-navex-red-dark hover:file:bg-navex-red/20" />
                    </label>
                    {uploadEnCours[index] && (
                      <div className="h-16 w-16 animate-pulse rounded-xl bg-navex-stone" />
                    )}
                    {!uploadEnCours[index] && p.photo_url && (
                      <div className="relative group">
                        <img src={p.photo_url} alt={p.photo_nom ?? ""} className="h-16 w-16 rounded-xl object-cover shadow-soft" />
                        <button type="button" onClick={() => retirerPhoto(index)}
                          className="absolute -top-1.5 -end-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-navex-red text-[10px] font-bold text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                          title={tProduit("photo_retirer")}>
                          ×
                        </button>
                      </div>
                    )}
                    {!uploadEnCours[index] && !p.photo_url && p.photo_nom && (
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-navex-red bg-navex-red-soft/40">
                        <span className="text-lg text-navex-red">⚠</span>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Bouton variante="secondaire" onClick={() => setProduits((a) => [...a, { ...PRODUIT_VIDE }])} className="border-dashed">
                {t("wizard.ajouter_produit")}
              </Bouton>
              <Bouton type="button" onClick={etapeSuivante} variante="primaire">
                {t("wizard.suivant")}
              </Bouton>
            </div>
          </section>
        )}

        {etape === 1 && (
          <section className="space-y-4">
            <div className="overflow-x-auto card-glass-solid rounded-3xl p-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200/60 text-start text-xs uppercase text-neutral-400">
                    <th className="py-2 text-start">{t("produit.sku")}</th>
                    <th className="py-2 text-start">{t("produit.designation")}</th>
                    <th className="py-2 text-end">{t("produit.dimensions_court")}</th>
                    <th className="py-2 text-end">{t("produit.poids")}</th>
                    <th className="py-2 text-end">{t("produit.quantite")}</th>
                    <th className="py-2 text-end">{t("volume_col")}</th>
                  </tr>
                </thead>
                <tbody>
                  {produits.map((p, i) => {
                    const volM3 = (Number(p.longueur_cm) * Number(p.largeur_cm) * Number(p.hauteur_cm) * (Number(p.quantite) || 0)) / 1_000_000;
                    return (
                      <tr key={i} className="border-b border-neutral-100/60">
                        <td className="py-2 text-navex-ink" dir="ltr">{p.sku_code}</td>
                        <td className="py-2 text-navex-ink">{p.designation} {p.fragile && "⚠"}</td>
                        <td className="py-2 text-end text-navex-ink" dir="ltr">{Number(p.longueur_cm)}×{Number(p.largeur_cm)}×{Number(p.hauteur_cm)}</td>
                        <td className="py-2 text-end text-navex-ink" dir="ltr">{Number(p.poids_kg)}</td>
                        <td className="py-2 text-end text-navex-ink" dir="ltr">{Number(p.quantite)}</td>
                        <td className="py-2 text-end text-navex-ink" dir="ltr">{fmtVol(volM3)} m³</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-neutral-500">
              {t("wizard.recap_total_colis", { total: totalColis })} · {t("wizard.recap_total_poids", { total: totalPoids.toFixed(2) })} · {t("volume_estime")} : {fmtVol(totalVolumeM3)} m³
            </p>
            <div className="card-glass rounded-3xl p-5 space-y-2">
              <h3 className="text-sm font-semibold text-navex-ink">{t("wizard.recap_volume_m3")}</h3>
              <p className="text-3xl font-extrabold text-navex-ink" dir="ltr">{fmtVol(totalVolumeM3)} m³</p>
            </div>
            <div className="flex items-center justify-between">
              <Bouton type="button" onClick={() => setEtape(0)} variante="secondaire">
                {t("wizard.precedent")}
              </Bouton>
              <Bouton type="button" onClick={etapeSuivante} variante="primaire">
                {t("wizard.suivant")}
              </Bouton>
            </div>
          </section>
        )}

        {etape === 2 && (
          <section className="card-glass-solid rounded-3xl p-10 text-center animate-slide-up">
            {referenceCreee ? (
              <div className="space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-navex-red text-2xl text-white shadow-glow-red">
                  ✓
                </div>
                <p className="text-sm font-medium text-navex-ink">{t("wizard.succes", { reference: referenceCreee })}</p>
                <Bouton href="/mes-demandes" variante="primaire">
                  {t("nav.mes_demandes")}
                </Bouton>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-lg font-semibold text-navex-ink">{t("volume_estime")} : {fmtVol(totalVolumeM3)} m³</p>
                <p className="text-sm text-navex-ink">{enEnvoi ? t("wizard.envoi_cours") : t("wizard.recap_vide")}</p>
                <div className="mx-auto max-w-lg text-start space-y-3">
                  <h3 className="text-sm font-semibold text-navex-ink">{t("conditions_titre")}</h3>
                  <p className="text-xs text-neutral-500 leading-relaxed">{t("conditions_texte")}</p>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={conditionsAcceptee}
                      onChange={(e) => setConditionsAcceptee(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-neutral-300"
                    />
                    <span className="text-sm font-medium text-navex-ink">{t("conditions_titre")}</span>
                  </label>
                </div>
                {!enEnvoi && (
                <Bouton type="button" onClick={envoyer} variante="primaire" disabled={!conditionsAcceptee}>
                  {t("wizard.envoyer")}
                </Bouton>
                )}
              </div>
            )}
          </section>
        )}

        <p className="text-start">
          <Bouton href="/mes-demandes" variante="secondaire">
            ← {t("commun.retour")}
          </Bouton>
        </p>
      </main>
    </div>
    </RequireRole>
  );
}
