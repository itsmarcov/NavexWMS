"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AppHeader } from "@/components/app-header";
import { Bouton } from "@/components/bouton";
import { RequireRole } from "@/components/require-role";
import { ProduitForm } from "@/components/produit-form";
import { messageErreur } from "@/lib/ui";
import {
  listerCatalogue,
  ajouterCatalogue,
  modifierCatalogue,
  supprimerCatalogue,
  type CatalogueProduitDTO,
  type AjouterCataloguePayload,
} from "@/lib/api-client";

type ShowForm = null | "ajouter" | { mode: "modifier"; produit: CatalogueProduitDTO };

export default function PageCatalogue() {
  const t = useTranslations();
  const [produits, setProduits] = useState<CatalogueProduitDTO[]>([]);
  const [q, setQ] = useState("");
  const [categorie, setCategorie] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<ShowForm>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qRef = useRef(q);
  qRef.current = q;

  const charger = useCallback(async (search: string, cat: string) => {
    setLoading(true);
    try {
      const data = await listerCatalogue(search || undefined, cat || undefined);
      setProduits(data);
    } catch {
      setErreur(messageErreur(t, { message: "network" }));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    charger(q, categorie);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => charger(q, categorie), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, categorie, charger]);

  function extraireCategories(): string[] {
    const set = new Set<string>();
    for (const p of produits) { if (p.categorie) set.add(p.categorie); }
    return Array.from(set).sort();
  }

  const topProduits = [...produits]
    .filter((p) => p.compteur_usage > 0)
    .sort((a, b) => b.compteur_usage - a.compteur_usage)
    .slice(0, 5);

  async function handleDelete(id: string) {
    if (!window.confirm(t("catalogue.confirmer_suppression"))) return;
    try {
      await supprimerCatalogue(id);
      setProduits((ps) => ps.filter((p) => p.id !== id));
    } catch (e) {
      setErreur(messageErreur(t, e));
    }
  }

  async function handleSubmit(dto: AjouterCataloguePayload) {
    setErreur(null);
    try {
      if (showForm && typeof showForm === "object" && showForm.mode === "modifier") {
        await modifierCatalogue(showForm.produit.id, dto);
      } else {
        await ajouterCatalogue(dto);
      }
      setShowForm(null);
      await charger(q, categorie);
    } catch (e) {
      setErreur(messageErreur(t, e));
    }
  }

  const categories = extraireCategories();

  return (
    <RequireRole roles={["expediteur"]}>
      <div className="min-h-dvh">
        <AppHeader />
        <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
          {erreur && (
            <p role="alert" className="rounded-2xl bg-navex-red-soft/80 px-4 py-2.5 text-sm text-navex-red-dark backdrop-blur-sm">
              {erreur}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-navex-ink">{t("catalogue.titre")}</h1>
              <span className="rounded-full bg-navex-stone px-2.5 py-0.5 text-xs font-semibold text-navex-ink">
                {produits.length}
              </span>
            </div>
            <Bouton variante="primaire" onClick={() => setShowForm("ajouter")}>
              {t("catalogue.ajouter")}
            </Bouton>
          </div>

          <div className="card-glass rounded-3xl p-4 flex flex-wrap items-end gap-3">
            <label className="block text-sm font-medium text-navex-ink flex-1 min-w-[200px]">
              🔍
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("catalogue.rechercher")}
                className="mt-1 block w-full rounded-2xl border border-neutral-200/80 bg-white/60 px-4 py-2.5 text-sm shadow-soft transition-all placeholder:text-neutral-400 focus:border-navex-red/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navex-red/10"
              />
            </label>
            <label className="block text-sm font-medium text-navex-ink min-w-[180px]">
              {t("catalogue.categorie")}
              <select
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className="mt-1 block w-full rounded-2xl border border-neutral-200/80 bg-white/60 px-4 py-2.5 text-sm shadow-soft transition-all focus:border-navex-red/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navex-red/10"
              >
                <option value="">{t("catalogue.toutes_categories")}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            {(q || categorie) && (
              <Bouton variante="secondaire" onClick={() => { setQ(""); setCategorie(""); }}>
                {t("catalogue.effacer")}
              </Bouton>
            )}
          </div>

          {topProduits.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-navex-ink">{t("catalogue.plus_utilises")}</h2>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {topProduits.map((p) => (
                  <span key={p.id} className="flex shrink-0 items-center gap-1.5 rounded-full bg-navex-red-soft/60 px-3 py-1 text-xs font-medium text-navex-red-dark">
                    <span dir="ltr" className="font-mono font-bold">{p.sku_code}</span>
                    <span className="rounded-full bg-navex-red/10 px-1.5 py-0.5 text-[10px] font-semibold">
                      {t("catalogue.utilisations", { count: p.compteur_usage })}
                    </span>
                  </span>
                ))}
              </div>
            </section>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-navex-red border-t-transparent" />
            </div>
          ) : produits.length === 0 ? (
            <div className="card-glass rounded-3xl p-16 text-center">
              <p className="text-sm text-neutral-500">{t("catalogue.aucun")}</p>
              <Bouton variante="primaire" onClick={() => setShowForm("ajouter")} className="mt-4">
                {t("catalogue.ajouter")}
              </Bouton>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {produits.map((p) => (
                <article key={p.id} className="card-glass rounded-2xl p-4 flex flex-col">
                  {p.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photo_url} alt={p.designation} className="mb-3 h-40 w-full rounded-xl object-cover" />
                  ) : (
                    <div className="mb-3 flex h-40 items-center justify-center rounded-xl bg-navex-stone/30 text-4xl">
                      📦
                    </div>
                  )}
                  <div dir="ltr" className="font-mono font-bold text-sm text-navex-ink">{p.sku_code}</div>
                  <div className="mt-1 text-sm text-navex-ink line-clamp-2">{p.designation}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-navex-stone px-2 py-0.5 text-[10px] font-semibold text-navex-ink">
                      {p.type_emballage}
                    </span>
                    {p.fragile && (
                      <span className="rounded-full bg-navex-red-soft px-2 py-0.5 text-[10px] font-semibold text-navex-red-dark">
                        {t("catalogue.fragile")}
                      </span>
                    )}
                    {p.categorie && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                        {p.categorie}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-neutral-500" dir="ltr">
                    {t("catalogue.dimensions", { l: p.longueur_cm, la: p.largeur_cm, h: p.hauteur_cm })} · {t("catalogue.poids", { p: p.poids_kg })}
                  </p>
                  {p.compteur_usage > 0 && (
                    <p className="mt-1 text-[10px] font-semibold text-navex-red-dark">
                      {t("catalogue.utilisations", { count: p.compteur_usage })}
                    </p>
                  )}
                  <div className="mt-auto pt-3 flex gap-2">
                    <Bouton variante="secondaire" onClick={() => setShowForm({ mode: "modifier", produit: p })} className="flex-1 text-xs">
                      {t("catalogue.modifier")}
                    </Bouton>
                    <Bouton variante="secondaire" onClick={() => handleDelete(p.id)} className="flex-1 text-xs border-navex-red text-navex-red hover:bg-navex-red hover:text-white">
                      {t("catalogue.supprimer")}
                    </Bouton>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>

        {showForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowForm(null); }}
          >
            <div className="card-glass rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
              <h2 className="mb-4 text-lg font-extrabold text-navex-ink">
                {showForm === "ajouter" ? t("catalogue.ajouter") : t("catalogue.modifier")}
              </h2>
              <ProduitForm
                initialValues={showForm === "ajouter" ? undefined : showForm.produit}
                onSubmit={handleSubmit}
                submitLabel={showForm === "ajouter" ? t("catalogue.ajouter") : t("catalogue.enregistrer")}
                onCancel={() => setShowForm(null)}
              />
            </div>
          </div>
        )}
      </div>
    </RequireRole>
  );
}
