"use client";

import { useState } from "react";

/* ── StatCard : carte saturée type "2.8K Total Package" de la référence ── */

export function StatCard({
  valeur,
  libelle,
  couleur = "amber",
}: {
  valeur: string;
  libelle: string;
  couleur?: "amber" | "info" | "success" | "alert";
}) {
  const fonds: Record<string, string> = {
    amber: "bg-navex-amber",
    info: "bg-navex-info",
    success: "bg-navex-success",
    alert: "bg-navex-alert",
  };
  return (
    <div className={`rounded-2xl p-4 text-white ${fonds[couleur]}`}>
      <p className="text-2xl font-bold">{valeur}</p>
      <p className="mt-0.5 text-xs opacity-90">{libelle}</p>
    </div>
  );
}

/* ── ScanFrame : cadre à coins ouverts pour l'écran de scan QR ──────────
   Reprend le signal visuel "pointez ici" de la référence, sans l'illustration
   3D (hors sujet pour un scan de décharge réel). Le cadre est purement CSS,
   pas d'image à charger — utile pour le mode offline du PWA entrepôt. */

export function ScanFrame({ actif }: { actif: boolean }) {
  return (
    <div className="relative mx-auto aspect-square w-64">
      <div className="absolute inset-0 overflow-hidden rounded-3xl bg-stone-900">
        {/* zone vidéo caméra réelle à monter ici (ex: html5-qrcode) */}
        <div className="flex h-full items-center justify-center text-stone-500 text-xs">
          Flux caméra
        </div>
        {actif && (
          <div className="absolute inset-x-0 top-0 h-0.5 animate-[scan_2s_ease-in-out_infinite] bg-navex-amber" />
        )}
      </div>
      {/* 4 coins ouverts */}
      {(["top-2 left-2 border-t-4 border-l-4 rounded-tl-xl",
        "top-2 right-2 border-t-4 border-r-4 rounded-tr-xl",
        "bottom-2 left-2 border-b-4 border-l-4 rounded-bl-xl",
        "bottom-2 right-2 border-b-4 border-r-4 rounded-br-xl"] as const
      ).map((pos) => (
        <span
          key={pos}
          className={`absolute h-8 w-8 border-navex-amber ${pos}`}
        />
      ))}
      <style jsx>{`
        @keyframes scan {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(15.5rem); }
        }
      `}</style>
    </div>
  );
}

/* ── Exemple d'assemblage : écran "Scanner un colis" agent entrepôt ────── */

export function ScanScreenExample() {
  const [scanning, setScanning] = useState(true);

  return (
    <div className="mx-auto max-w-sm rounded-3xl bg-white p-6 shadow-card">
      <h1 className="text-center text-lg font-bold text-navex-ink">Scanner la décharge</h1>
      <p className="mx-auto mt-2 max-w-[85%] text-center text-xs text-stone-500">
        Placez le QR code de la décharge dans le cadre pour confirmer l'arrivée.
      </p>

      <div className="mt-6">
        <ScanFrame actif={scanning} />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        <StatCard valeur="12" libelle="Reçus aujourd'hui" couleur="info" />
        <StatCard valeur="3" libelle="À positionner" couleur="amber" />
        <StatCard valeur="0" libelle="Anomalies" couleur="alert" />
      </div>

      <button
        onClick={() => setScanning((s) => !s)}
        className="mt-6 w-full rounded-full bg-navex-amber py-3 text-sm font-semibold text-white"
      >
        {scanning ? "Mettre en pause" : "Reprendre le scan"}
      </button>
    </div>
  );
}
