"use client";

/**
 * Grille d'occupation des emplacements — l'équivalent Navex de la grille
 * "calendrier" de la maquette de référence, mais branchée sur de vraies
 * données métier plutôt que décorative.
 *
 * Chaque case = un Emplacement réel (zone/allée/rack/niveau).
 * La couleur encode son état courant, dérivé de son statut `occupee` et
 * du dernier `MouvementEntrepot` associé à la décharge qui l'occupe.
 *
 * Usage prévu : dashboard agent entrepôt (/warehouse) et admin — vue
 * d'ensemble en un coup d'œil, cliquable pour ouvrir le détail.
 */

export type EtatEmplacement = "libre" | "occupee" | "a_traiter" | "maintenance";

export interface EmplacementGrille {
  id: string;
  label: string; // ex: "A-3-R2-N1"
  etat: EtatEmplacement;
}

const STYLES: Record<EtatEmplacement, string> = {
  libre: "bg-white border border-stone-200 text-stone-400",
  occupee: "bg-navex-amber text-white border border-navex-amber",
  a_traiter: "bg-navex-info text-white border border-navex-info",
  maintenance: "bg-navex-alert text-white border border-navex-alert",
};

const LEGENDE: { etat: EtatEmplacement; libelle: string }[] = [
  { etat: "libre", libelle: "Libre" },
  { etat: "a_traiter", libelle: "À positionner" },
  { etat: "occupee", libelle: "Occupé" },
  { etat: "maintenance", libelle: "Maintenance" },
];

export function OccupancyGrid({
  emplacements,
  onSelect,
}: {
  emplacements: EmplacementGrille[];
  onSelect?: (id: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-navex-ink">Occupation entrepôt</h2>
        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
          {emplacements.filter((e) => e.etat === "occupee").length} / {emplacements.length}
        </span>
      </div>

      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-11">
        {emplacements.map((e) => (
          <button
            key={e.id}
            title={e.label}
            onClick={() => onSelect?.(e.id)}
            className={`aspect-square rounded-lg text-[10px] font-semibold transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navex-ink ${STYLES[e.etat]}`}
          >
            {e.label.split("-").pop()}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 border-t border-stone-100 pt-3">
        {LEGENDE.map((l) => (
          <div key={l.etat} className="flex items-center gap-1.5 text-xs text-stone-500">
            <span className={`h-2.5 w-2.5 rounded-sm ${STYLES[l.etat].split(" ")[0]}`} />
            {l.libelle}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Exemple de mapping depuis vos données Prisma existantes :
 *
 * const emplacements: EmplacementGrille[] = data.map((e) => ({
 *   id: e.id,
 *   label: `${e.zone}-${e.allee}-${e.rack}-${e.niveau}`,
 *   etat: !e.occupee
 *     ? "libre"
 *     : e.dernierMouvement?.type_evenement === "reception_confirmee"
 *       ? "a_traiter"
 *       : "occupee",
 * }));
 */
