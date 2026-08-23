// Test E2E Phase 4 : module agent entrepÃ´t (scan QR, rÃ©ception, positionnement).
// Usage : node scripts/essai-phase4.mjs <URL_API>
const BASE = process.argv[2] ?? "http://localhost:3001/api";

async function api(chemin, options = {}, token = null) {
  const reponse = await fetch(`${BASE}${chemin}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const corps = await reponse.json().catch(() => null);
  return { statut: reponse.status, corps };
}

function verifier(condition, libelle) {
  console.log(`${condition ? "OK" : "**ECHEC**"} - ${libelle}`);
  if (!condition) process.exitCode = 1;
}

const connexion = async (email) =>
  (
    await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password: "Test@1234" }) })
  ).corps?.access_token;

const principal = async () => {
  const jetonExpediteur = await connexion("expediteur@navex.dz");
  const jetonCommercial = await connexion("commercial@navex.dz");
  const jetonEntrepot = await connexion("entrepot@navex.dz");
  verifier(!!jetonExpediteur && !!jetonCommercial && !!jetonEntrepot, "connexions des trois comptes");

  // â”€â”€ PrÃ©paration : demande approuvÃ©e avec dÃ©charge fraÃ®che â”€â”€
  const creation = await api(
    "/demandes",
    {
      method: "POST",
      body: JSON.stringify({
        produits: [
          { sku_code: "P4-A", designation: "Palettes riz", longueur_cm: 120, largeur_cm: 80, hauteur_cm: 150, poids_kg: 500, fragile: false, type_emballage: "palette", quantite: 4 },
          { sku_code: "P4-B", designation: "Cartons verrerie", longueur_cm: 60, largeur_cm: 40, hauteur_cm: 40, poids_kg: 12, fragile: true, type_emballage: "carton", quantite: 20 },
        ],
      }),
    },
    jetonExpediteur,
  );
  const demande = creation.corps;
  verifier(demande?.reference?.startsWith("DEM-"), `demande crÃ©Ã©e (${demande?.reference})`);

  for (const produit of demande.produits) {
    const d = await api(
      `/demandes/${demande.id}/produits/${produit.id}/validation`,
      { method: "PATCH", body: JSON.stringify({ statut_validation: "approuve" }) },
      jetonCommercial,
    );
    verifier(d.statut === 200, `produit ${produit.sku_code} approuvÃ©`);
  }

  const dechargeRes = await api(
    "/decharges/generate",
    { method: "POST", body: JSON.stringify({ demande_id: demande.id }) },
    jetonExpediteur,
  );
  verifier(dechargeRes.statut === 201 || dechargeRes.statut === 200, `dÃ©charge gÃ©nÃ©rÃ©e (${dechargeRes.statut})`);
  const qrToken = dechargeRes.corps?.qr_token;
  verifier(typeof qrToken === "string" && qrToken.split(".").length === 3, "qr_token JWT disponible");

  // â”€â”€ RBAC â”€â”€
  const refusExp = await api("/entrepot/scan", { method: "POST", body: JSON.stringify({ qr_token: qrToken }) }, jetonExpediteur);
  verifier(refusExp.statut === 403, `expÃ©diteur bloquÃ© sur /entrepot/scan (${refusExp.statut})`);
  const refusCom = await api("/entrepot/scan", { method: "POST", body: JSON.stringify({ qr_token: qrToken }) }, jetonCommercial);
  verifier(refusCom.statut === 403, `agent commercial bloquÃ© sur /entrepot/scan (${refusCom.statut})`);

  // â”€â”€ QR falsifiÃ© â”€â”€
  const falsifie = qrToken.slice(0, -2) + (qrToken.endsWith("AA") ? "BB" : "AA");
  const scanFaux = await api("/entrepot/scan", { method: "POST", body: JSON.stringify({ qr_token: falsifie }) }, jetonEntrepot);
  verifier(scanFaux.statut === 401 && scanFaux.corps?.code === "erreurs.qr_invalide", `QR falsifiÃ© rejetÃ© (${scanFaux.statut})`);
  const scanNul = await api("/entrepot/scan", { method: "POST", body: JSON.stringify({ qr_token: "pas un jwt" }) }, jetonEntrepot);
  verifier(scanNul.statut === 401, `jeton non-JWT rejetÃ© (${scanNul.statut})`);

  // â”€â”€ Scan valide â”€â”€
  const scan = await api("/entrepot/scan", { method: "POST", body: JSON.stringify({ qr_token: qrToken }) }, jetonEntrepot);
  verifier(scan.statut === 201 || scan.statut === 200, `scan acceptÃ© (${scan.statut})`);
  verifier(scan.corps?.numero_decharge === dechargeRes.corps.numero_decharge, `numÃ©ro retournÃ© ${scan.corps?.numero_decharge}`);
  verifier(scan.corps?.nb_produits === 2, "compteur produits approuvÃ©s = 2");

  // Double scan refusé (réponse enrichie avec decharge_id pour l'interface douchette)
  const doubleScan = await api("/entrepot/scan", { method: "POST", body: JSON.stringify({ qr_token: qrToken }) }, jetonEntrepot);
  verifier(doubleScan.statut === 409 && doubleScan.corps?.code === "erreurs.decharge_deja_scannee", `double scan refusé (${doubleScan.statut})`);
  verifier(doubleScan.corps?.decharge_id === dechargeRes.corps.id, "decharge_id fourni dans le conflit");

  // File des dÃ©charges scannÃ©es
  const file = await api("/entrepot/decharges", {}, jetonEntrepot);
  const entreeFile = file.corps?.find((d) => d.id === dechargeRes.corps.id);
  verifier(!!entreeFile, "dÃ©charge visible dans la file entrepÃ´t");
  verifier(entreeFile?.evenements?.includes("arrivee_scannee"), "Ã©vÃ©nement arrivee_scannee prÃ©sent");

  // â”€â”€ Positionnement avant rÃ©ception interdit â”€â”€
  const libresAvant = await api("/entrepot/emplacements?libres=1", {}, jetonEntrepot);
  verifier(Array.isArray(libresAvant.corps) && libresAvant.corps.length > 0, `${libresAvant.corps?.length} emplacements libres`);
  const unEmplacement = libresAvant.corps[0];
  const positionnementHatif = await api(
    `/entrepot/decharges/${dechargeRes.corps.id}/positionnement`,
    { method: "POST", body: JSON.stringify({ emplacement_id: unEmplacement.id }) },
    jetonEntrepot,
  );
  verifier(positionnementHatif.statut === 409 && positionnementHatif.corps?.code === "erreurs.reception_requise", `positionnement sans rÃ©ception refusÃ© (${positionnementHatif.statut})`);

  // â”€â”€ RÃ©ception â”€â”€
  const reception = await api(
    `/entrepot/decharges/${dechargeRes.corps.id}/reception`,
    { method: "POST", body: JSON.stringify({ notes: "Colis conformes au chargement" }) },
    jetonEntrepot,
  );
  verifier(reception.statut === 201 || reception.statut === 200, `rÃ©ception confirmÃ©e (${reception.statut})`);
  const receptionDouble = await api(`/entrepot/decharges/${dechargeRes.corps.id}/reception`, { method: "POST", body: "{}" }, jetonEntrepot);
  verifier(receptionDouble.statut === 409 && receptionDouble.corps?.code === "erreurs.deja_recue", `double rÃ©ception refusÃ©e (${receptionDouble.statut})`);

  // â”€â”€ Positionnement â”€â”€
  const positionnement = await api(
    `/entrepot/decharges/${dechargeRes.corps.id}/positionnement`,
    { method: "POST", body: JSON.stringify({ emplacement_id: unEmplacement.id }) },
    jetonEntrepot,
  );
  verifier(positionnement.statut === 201 || positionnement.statut === 200, `positionnement effectuÃ© (${positionnement.statut})`);

  const libresApres = await api("/entrepot/emplacements?libres=1", {}, jetonEntrepot);
  verifier(!libresApres.corps?.some((e) => e.id === unEmplacement.id), "emplacement retirÃ© de la liste libre");
  const occupee = await api("/entrepot/emplacements?libres=0", {}, jetonEntrepot);
  const emplOccupee = occupee.corps?.find((e) => e.id === unEmplacement.id);
  verifier(emplOccupee?.occupee === true, "emplacement marquÃ© occupÃ©");

  const doublePositionnement = await api(
    `/entrepot/decharges/${dechargeRes.corps.id}/positionnement`,
    { method: "POST", body: JSON.stringify({ emplacement_id: libresApres.corps[0].id }) },
    jetonEntrepot,
  );
  verifier(doublePositionnement.statut === 409 && doublePositionnement.corps?.code === "erreurs.deja_positionnee", `double positionnement refusÃ© (${doublePositionnement.statut})`);

  // â”€â”€ DÃ©tail complet + RBAC dÃ©tail â”€â”€
  const detail = await api(`/entrepot/decharges/${dechargeRes.corps.id}`, {}, jetonEntrepot);
  verifier(detail.corps?.mouvements?.length === 3, `timeline complÃ¨te (3 mouvements : ${detail.corps?.mouvements?.length})`);
  verifier(detail.corps?.mouvements?.some((m) => m.emplacement), "emplacement renseignÃ© dans la timeline");
  verifier(detail.corps?.produits?.length === 2, "produits approuvÃ©s listÃ©s dans le dÃ©tail");

  const detailRefuse = await api(`/entrepot/decharges/${dechargeRes.corps.id}`, {}, jetonExpediteur);
  verifier(detailRefuse.statut === 403, `expÃ©diteur bloquÃ© sur le dÃ©tail entrepÃ´t (${detailRefuse.statut})`);

  console.log(process.exitCode ? "\n== ECHECS DETECTES ==" : "\n== TOUS LES TESTS PASSENT ==");
};

principal().catch((erreur) => {
  console.error("**ERREUR FATALE**", erreur);
  process.exitCode = 1;
});
