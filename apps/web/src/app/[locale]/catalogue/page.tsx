"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
  creerDemande,
  type CatalogueProduitDTO,
  type AjouterCataloguePayload,
} from "@/lib/api-client";

type ShowForm = null | "ajouter" | { mode: "modifier"; produit: CatalogueProduitDTO };

interface CartItem {
  produit: CatalogueProduitDTO;
  quantite: number;
}

export default function PageCatalogue() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [produits, setProduits] = useState<CatalogueProduitDTO[]>([]);
  const [q, setQ] = useState("");
  const [categorie, setCategorie] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<ShowForm>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [panier, setPanier] = useState<CartItem[]>([] as CartItem[]);
  const [showPanier, setShowPanier] = useState(false);
  const [enCoursEnvoyer, setEnCoursEnvoyer] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const charger = useCallback(async (search: string, cat: string) => {
    setLoading(true);
    try {
      const data = await listerCatalogue(search || undefined, cat || undefined);
      setProduits(data);
    } catch (err) {
      setErreur(messageErreur(t, err));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { charger(q, categorie); }, []); // eslint-disable-line react-hooks/exhaustive-deps
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

  const topProduits = [...produits].filter((p) => p.compteur_usage > 0).sort((a, b) => b.compteur_usage - a.compteur_usage).slice(0, 5);

  // ── Panier ──
  function ajouterAuPanier(produit: CatalogueProduitDTO) {
    setPanier((prev) => {
      const idx = prev.findIndex((i) => i.produit.id === produit.id);
      if (idx >= 0) {
        return prev.map((item, i) => i === idx ? { produit: item.produit, quantite: item.quantite + 1 } : item);
      }
      return [...prev, { produit, quantite: 1 }];
    });
    setSucces(null);
    setErreur(null);
  }

  function modifierQuantite(produitId: string, qte: number) {
    if (qte < 1) return;
    setPanier((prev) => prev.map((i) => i.produit.id === produitId ? { ...i, quantite: qte } : i));
  }

  function retirerDuPanier(produitId: string) {
    setPanier((prev) => prev.filter((i) => i.produit.id !== produitId));
  }

  const nbPanier = panier.reduce((s, i) => s + i.quantite, 0);

  async function envoyerDemande() {
    if (panier.length === 0) return;
    setEnCoursEnvoyer(true);
    setErreur(null);
    try {
      await creerDemande(
        panier.map((i) => ({
          sku_code: i.produit.sku_code,
          designation: i.produit.designation,
          longueur_cm: i.produit.longueur_cm,
          largeur_cm: i.produit.largeur_cm,
          hauteur_cm: i.produit.hauteur_cm,
          poids_kg: i.produit.poids_kg,
          fragile: i.produit.fragile,
          type_emballage: i.produit.type_emballage,
          quantite: i.quantite,
          photo_url: i.produit.photo_url,
        })),
        true,
      );
      setPanier([]);
      setShowPanier(false);
      setSucces(t("catalogue.demande_creee"));
      setTimeout(() => router.push(`/${locale}/mes-demandes`), 1500);
    } catch (e) {
      setErreur(messageErreur(t, e));
    } finally {
      setEnCoursEnvoyer(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t("catalogue.confirmer_suppression"))) return;
    try {
      await supprimerCatalogue(id);
      setProduits((ps) => ps.filter((p) => p.id !== id));
      setPanier((prev) => prev.filter((i) => i.produit.id !== id));
    } catch (e) { setErreur(messageErreur(t, e)); }
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
    } catch (e) { setErreur(messageErreur(t, e)); }
  }

  const categories = extraireCategories();

  return (
    <RequireRole roles={["expediteur"]}>
      <div className="min-h-dvh bg-ambient">
        <AppHeader />
        <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
          {erreur && (
            <p role="alert" className="animate-slide-up rounded-2xl bg-navex-red-soft/80 px-4 py-2.5 text-sm text-navex-red-dark backdrop-blur-sm">
              {erreur}
            </p>
          )}
          {succes && (
            <p role="status" className="animate-slide-up rounded-2xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 backdrop-blur-sm">
              {succes}
            </p>
          )}

          {/* ── Header ── */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-navex-ink">{t("catalogue.titre")}</h1>
              <span className="rounded-full bg-navex-red px-2.5 py-0.5 text-xs font-bold text-white">
                {produits.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Bouton variante="primaire" onClick={() => setShowForm("ajouter")}>
                + {t("catalogue.ajouter")}
              </Bouton>
              <button
                onClick={() => setShowPanier(!showPanier)}
                className="relative flex items-center gap-2 rounded-full bg-navex-ink px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-all hover:bg-navex-ink/80 hover:shadow-md active:scale-95"
              >
                📋 {t("catalogue.demande")}
                {nbPanier > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-navex-red px-1.5 text-[10px] font-bold text-white animate-fade-in">
                    {nbPanier}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* ── Filters ── */}
          <div className="card-glass rounded-3xl p-4 flex flex-wrap items-end gap-3">
            <label className="block text-sm font-medium text-navex-ink flex-1 min-w-[200px]">
              🔍 {t("catalogue.rechercher")}
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("catalogue.rechercher")}
                className="mt-1 block w-full rounded-2xl border border-neutral-200/80 bg-white/60 px-4 py-2.5 text-sm shadow-soft transition-all placeholder:text-neutral-400 focus:border-navex-red/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navex-red/10" />
            </label>
            <label className="block text-sm font-medium text-navex-ink min-w-[180px]">
              {t("catalogue.categorie")}
              <select value={categorie} onChange={(e) => setCategorie(e.target.value)}
                className="mt-1 block w-full rounded-2xl border border-neutral-200/80 bg-white/60 px-4 py-2.5 text-sm shadow-soft transition-all focus:border-navex-red/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navex-red/10">
                <option value="">{t("catalogue.toutes_categories")}</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {(q || categorie) && (
              <Bouton variante="secondaire" onClick={() => { setQ(""); setCategorie(""); }}>
                {t("catalogue.effacer")}
              </Bouton>
            )}
          </div>

          {/* ── Top produits ── */}
          {topProduits.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-navex-ink">⭐ {t("catalogue.plus_utilises")}</h2>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {topProduits.map((p) => (
                  <button key={p.id} onClick={() => ajouterAuPanier(p)}
                    className="flex shrink-0 items-center gap-2 rounded-full bg-navex-red-soft/60 px-3 py-1.5 text-xs font-medium text-navex-red-dark transition-all hover:bg-navex-red hover:text-white hover:shadow-md active:scale-95 group">
                    <span dir="ltr" className="font-mono font-bold">{p.sku_code}</span>
                    <span className="rounded-full bg-navex-red/10 px-1.5 py-0.5 text-[10px] font-semibold group-hover:bg-white/20">
                      ×{p.compteur_usage}
                    </span>
                    <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">+ {t("catalogue.ajouter")}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Grid ── */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-navex-red border-t-transparent" />
            </div>
          ) : produits.length === 0 ? (
            <div className="card-glass rounded-3xl p-16 text-center space-y-4">
              <div className="text-5xl">📦</div>
              <p className="text-sm text-neutral-500">{t("catalogue.aucun")}</p>
              <Bouton variante="primaire" onClick={() => setShowForm("ajouter")}>
                + {t("catalogue.ajouter")}
              </Bouton>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {produits.map((p) => {
                const inCart = panier.some((i) => i.produit.id === p.id);
                return (
                  <article key={p.id} className={`card-glass rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${inCart ? "ring-2 ring-navex-red/30" : ""}`}>
                    {p.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photo_url} alt={p.designation} className="h-36 w-full object-cover" />
                    ) : (
                      <div className="flex h-36 items-center justify-center bg-gradient-to-br from-navex-stone/50 to-navex-stone/30 text-4xl">
                        📦
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div dir="ltr" className="font-mono text-sm font-bold text-navex-ink">{p.sku_code}</div>
                        {p.compteur_usage > 0 && (
                          <span className="shrink-0 rounded-full bg-navex-red-soft px-1.5 py-0.5 text-[10px] font-bold text-navex-red-dark">
                            ×{p.compteur_usage}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-navex-ink line-clamp-2">{p.designation}</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="rounded-full bg-navex-stone px-2 py-0.5 text-[10px] font-semibold text-navex-ink capitalize">{p.type_emballage}</span>
                        {p.fragile && <span className="rounded-full bg-navex-red-soft px-2 py-0.5 text-[10px] font-semibold text-navex-red-dark">⚠ {t("catalogue.fragile")}</span>}
                        {p.categorie && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{p.categorie}</span>}
                      </div>
                      <p className="text-xs text-neutral-400" dir="ltr">
                        {p.longueur_cm}×{p.largeur_cm}×{p.hauteur_cm} cm · {p.poids_kg} kg
                      </p>
                      <div className="flex gap-2 pt-1">
                        <Bouton variante="primaire" onClick={() => ajouterAuPanier(p)} className="flex-1 text-xs">
                          + {t("catalogue.ajouter_demande")}
                        </Bouton>
                        <Bouton variante="secondaire" onClick={() => setShowForm({ mode: "modifier", produit: p })} className="text-xs px-2">
                          ✏️
                        </Bouton>
                        <button onClick={() => handleDelete(p.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-neutral-400 transition-colors hover:bg-navex-red-soft hover:text-navex-red"
                          title={t("catalogue.supprimer")}>
                          🗑
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>

        {/* ── Panier drawer ── */}
        {showPanier && (
          <div className={`fixed inset-0 z-50 flex ${locale === "ar" ? "justify-start" : "justify-end"} bg-black/40`} onClick={(e) => { if (e.target === e.currentTarget) setShowPanier(false); }}>
            <div className="h-full w-full max-w-md bg-white shadow-2xl animate-slide-up flex flex-col">
              <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
                <h2 className="text-lg font-extrabold text-navex-ink">📋 {t("catalogue.demande")}</h2>
                <button onClick={() => setShowPanier(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-navex-stone text-sm text-neutral-500 hover:bg-navex-red-soft hover:text-navex-red transition-colors">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {panier.length === 0 ? (
                  <div className="py-16 text-center text-sm text-neutral-400">
                    <div className="mb-3 text-4xl">📋</div>
                    {t("catalogue.demande_vide")}
                  </div>
                ) : panier.map((item) => (
                  <div key={item.produit.id} className="flex gap-3 rounded-2xl bg-navex-stone/40 p-3 animate-fade-in">
                    {item.produit.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.produit.photo_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-navex-stone/60 text-xl">📦</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div dir="ltr" className="truncate font-mono text-xs font-bold text-navex-ink">{item.produit.sku_code}</div>
                      <p className="truncate text-xs text-neutral-500">{item.produit.designation}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-[10px] text-neutral-400">{t("catalogue.quantite")}</span>
                        <input
                          type="number" min="1" dir="ltr"
                          value={item.quantite}
                          onChange={(e) => modifierQuantite(item.produit.id, Math.max(1, Number(e.target.value) || 1))}
                          className="h-7 w-16 rounded-lg border border-neutral-200 bg-white px-2 text-center text-xs font-bold text-navex-ink shadow-sm focus:border-navex-red/40 focus:outline-none focus:ring-1 focus:ring-navex-red/10"
                        />
                      </div>
                    </div>
                    <button onClick={() => retirerDuPanier(item.produit.id)}
                      className="self-start text-neutral-300 hover:text-navex-red transition-colors text-sm">
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {panier.length > 0 && (
                <div className="border-t border-neutral-100 px-6 py-4 space-y-3">
                  <div className="flex items-center justify-between text-sm text-neutral-500">
                    <span>{t("catalogue.articles_count", { count: nbPanier })}</span>
                    <span className="font-semibold text-navex-ink">{panier.length} produit{panier.length > 1 ? "s" : ""}</span>
                  </div>
                  <Bouton variante="primaire" onClick={envoyerDemande} disabled={enCoursEnvoyer} className="w-full">
                    {enCoursEnvoyer ? "…" : t("catalogue.envoyer_demande")}
                  </Bouton>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Form modal ── */}
        {showForm && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowForm(null); }}>
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
