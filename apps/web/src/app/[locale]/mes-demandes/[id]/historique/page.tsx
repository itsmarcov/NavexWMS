"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { historiqueDemande } from "@/lib/api-client";
import { formaterDate, messageErreur } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";
import { RequireRole } from "@/components/require-role";
import { Bouton } from "@/components/bouton";

interface HistoriqueEntree {
  id: string;
  action: string;
  date: string;
  utilisateur?: { email: string; prenom?: string | null; nom?: string | null } | null;
  donnees_avant?: Record<string, unknown> | null;
  donnees_apres?: Record<string, unknown> | null;
}

const ACTION_KEYS: Record<string, string> = {
  CREATE: "historique.action_create",
  VALIDATION_APPROUVE: "historique.action_validation_approve",
  VALIDATION_REFUSE: "historique.action_validation_refuse",
  PLANIFICATION_RECEPTION: "historique.action_planification",
  SCAN_ARRIVEE: "historique.action_scan",
  RECEPTION_CONFIRMEE: "historique.action_reception",
  REPOSITIONNEMENT: "historique.action_positionnement",
  GENERATION_DECHARGE: "historique.action_decharge_generate",
  TELECHARGEMENT_DECHARGE: "historique.action_decharge_download",
};

const ACTION_ICONS: Record<string, string> = {
  CREATE: "📝",
  VALIDATION_APPROUVE: "✅",
  VALIDATION_REFUSE: "❌",
  PLANIFICATION_RECEPTION: "📅",
  SCAN_ARRIVEE: "📱",
  RECEPTION_CONFIRMEE: "📦",
  REPOSITIONNEMENT: "🗄️",
  GENERATION_DECHARGE: "📄",
  TELECHARGEMENT_DECHARGE: "⬇️",
};

export default function PageHistorique() {
  const t = useTranslations();
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [entrees, setEntrees] = useState<HistoriqueEntree[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    historiqueDemande(id)
      .then(setEntrees)
      .catch((e) => setErreur(messageErreur(t, e)));
  }, [id, t]);

  function formatUser(u: HistoriqueEntree["utilisateur"]) {
    if (!u) return "—";
    const parts = [u.prenom, u.nom].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : u.email;
  }

  function formatDonnees(d: Record<string, unknown> | null | undefined) {
    if (!d) return null;
    const entries = Object.entries(d).filter(([k]) => !["id", "demande_id"].includes(k));
    if (entries.length === 0) return null;
    return entries;
  }

  const FIELD_LABELS: Record<string, string> = {
    statut: "historique.champ_statut",
    date_reception_prevue: "historique.champ_date_reception",
    date_validation: "historique.champ_date_validation",
    commentaire: "historique.champ_commentaire",
    sku_code: "historique.champ_sku",
    designation: "historique.champ_designation",
    type_emballage: "historique.champ_emballage",
    statut_validation: "historique.champ_statut_validation",
    quantite: "historique.champ_quantite",
    date: "historique.champ_date",
    motif: "historique.champ_motif",
  };

  return (
    <RequireRole roles={["expediteur", "agent_commercial", "agent_entrepot", "admin"]}>
      <div className="min-h-dvh">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
          <h1 className="text-2xl font-extrabold text-navex-ink">{t("historique.titre")}</h1>

          {erreur && (
            <p role="alert" className="rounded-2xl bg-navex-red-soft/80 px-4 py-2.5 text-sm text-navex-red-dark backdrop-blur-sm">
              {erreur}
            </p>
          )}

          {!entrees && !erreur && (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-navex-red border-t-transparent" />
            </div>
          )}

          {entrees && entrees.length === 0 && (
            <p className="card-glass rounded-3xl p-10 text-center text-sm text-neutral-500">
              {t("historique.aucun_evenement")}
            </p>
          )}

          {entrees && entrees.length > 0 && (
            <div className="relative space-y-4 ps-6">
              <div className="absolute end-2 top-0 bottom-0 w-0.5 bg-navex-stone" />
              {entrees.map((e) => {
                const actionKey = ACTION_KEYS[e.action];
                const icon = ACTION_ICONS[e.action] || "🔹";
                const avant = formatDonnees(e.donnees_avant);
                const apres = formatDonnees(e.donnees_apres);
                return (
                  <div key={e.id} className="relative card-glass rounded-2xl p-4 animate-slide-up">
                    <div className="absolute -end-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm shadow-soft ring-1 ring-neutral-200/60">
                      {icon}
                    </div>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-navex-ink">
                          {actionKey ? t(actionKey) : e.action}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-400">
                          {t("historique.utilisateur")} : {formatUser(e.utilisateur)}
                        </p>
                      </div>
                      <time className="text-xs text-neutral-400" dateTime={e.date}>
                        {formaterDate(e.date, locale)}
                      </time>
                    </div>
                    {(avant || apres) && (
                      <div className="mt-3 space-y-1 rounded-xl bg-navex-stone/50 p-3 text-xs">
                        {apres && apres.map(([k, v]) => {
                          const labelKey = FIELD_LABELS[k];
                          return (
                            <div key={k} className="flex gap-2">
                              <span className="font-medium text-navex-ink">{labelKey ? t(labelKey) : k}:</span>
                              <span className="text-neutral-500" dir="ltr">{String(v)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Bouton href={`/mes-demandes/${id}`} variante="secondaire">
            {locale === "ar" ? "→" : "←"} {t("historique.retour")}
          </Bouton>
        </main>
      </div>
    </RequireRole>
  );
}
