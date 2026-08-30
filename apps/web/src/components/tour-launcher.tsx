"use client";

import { useCallback, useEffect, useState } from "react";
import type { Role, UtilisateurDTO } from "@navex/contracts";
import { utilisateurCourant } from "@/lib/api-client";
import { GuidedTour } from "@/components/guided-tour";

const TOUR_KEY = "navex_tour_termine";

export function TourLauncher() {
  const [utilisateur, setUtilisateur] = useState<UtilisateurDTO | null>(null);
  const [actif, setActif] = useState(false);

  useEffect(() => {
    utilisateurCourant()
      .then((u) => {
        setUtilisateur(u);
        if (!u.tour_termine && !localStorage.getItem(TOUR_KEY)) {
          setActif(true);
        }
      })
      .catch(() => undefined);

    function onRelancer() { setActif(true); }
    window.addEventListener("navex:relancer-tour", onRelancer);
    return () => window.removeEventListener("navex:relancer-tour", onRelancer);
  }, []);

  const onComplete = useCallback(() => {
    setActif(false);
    if (utilisateur) localStorage.setItem(TOUR_KEY, "1");
  }, [utilisateur]);

  if (!actif || !utilisateur) return null;

  return (
    <GuidedTour
      role={utilisateur.role as Role}
      onComplete={onComplete}
    />
  );
}
