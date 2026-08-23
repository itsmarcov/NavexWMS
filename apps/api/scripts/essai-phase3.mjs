// Test E2E Phase 3 : validation produit par l'agent commercial.
// Usage : node scripts/essai-phase3.mjs <URL_API>
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
  (await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password: "Test@1234" }) })).corps
    ?.access_token;

const principal = async () => {
  // 1. Connexions des deux rôles
  const jetonExpediteur = await connexion("expediteur@navex.dz");
  const jetonCommercial = await connexion("commercial@navex.dz");
  const jetonEntrepot = await connexion("entrepot@navex.dz");
  verifier(!!jetonExpediteur && !!jetonCommercial && !!jetonEntrepot, "connexions des trois comptes");

  // 2. L'expéditeur crée une demande de 3 produits
  const creation = await api(
    "/demandes",
    {
      method: "POST",
      body: JSON.stringify({
        produits: [
          { sku_code: "P3-A", designation: "Produit A", longueur_cm: 10, largeur_cm: 10, hauteur_cm: 10, poids_kg: 1, fragile: false, type_emballage: "carton", quantite: 5 },
          { sku_code: "P3-B", designation: "Produit B", longueur_cm: 20, largeur_cm: 20, hauteur_cm: 20, poids_kg: 2, fragile: true, type_emballage: "palette", quantite: 2 },
          { sku_code: "P3-C", designation: "Produit C", longueur_cm: 30, largeur_cm: 30, hauteur_cm: 30, poids_kg: 3, fragile: false, type_emballage: "sac", quantite: 10 },
        ],
      }),
    },
    jetonExpediteur,
  );
  verifier(creation.statut === 201 || creation.statut === 200, `création demande (${creation.statut})`);
  const demande = creation.corps;
  verifier(demande?.reference?.startsWith("DEM-"), `référence ${demande?.reference}`);

  // 3. File d'attente : la nouvelle demande doit y figurer avec ses produits
  const file = await api("/demandes?attente=1", {}, jetonCommercial);
  verifier(file.corps?.some((d) => d.id === demande.id), "demande présente dans la file d'attente");
  verifier(
    file.corps?.find((d) => d.id === demande.id)?.produits?.every((p) => p.statut_validation === "en_attente"),
    "file d'attente expose les statuts produits",
  );

  // 4. RBAC : un expéditeur et un agent entrepôt ne peuvent pas valider
  const refus1 = await api(
    `/demandes/${demande.id}/produits/${demande.produits[0].id}/validation`,
    { method: "PATCH", body: JSON.stringify({ statut_validation: "approuve" }) },
    jetonExpediteur,
  );
  verifier(refus1.statut === 403, `expéditeur bloqué sur validation (${refus1.statut})`);
  const refus2 = await api(
    `/demandes/${demande.id}/planification`,
    { method: "PATCH", body: JSON.stringify({ date_reception_prevue: new Date().toISOString() }) },
    jetonEntrepot,
  );
  verifier(refus2.statut === 403, `agent entrepôt bloqué sur planification (${refus2.statut})`);

  // 5. Validation invalide → 400
  const invalide = await api(
    `/demandes/${demande.id}/produits/${demande.produits[0].id}/validation`,
    { method: "PATCH", body: JSON.stringify({ statut_validation: "peut_etre" }) },
    jetonCommercial,
  );
  verifier(invalide.statut === 400, `décision invalide rejetée (${invalide.statut})`);

  // 6. Décisions mixtes : refuse A (+commentaire), approuve B et C
  const d1 = await api(
    `/demandes/${demande.id}/produits/${demande.produits[0].id}/validation`,
    { method: "PATCH", body: JSON.stringify({ statut_validation: "refuse", commentaire: "Dimensions non conformes" }) },
    jetonCommercial,
  );
  verifier(d1.statut === 200 && d1.corps?.statut_validation === "refuse", `produit A refusé (${d1.statut})`);
  verifier(d1.corps?.commentaire === "Dimensions non conformes", "commentaire enregistré");

  const d2 = await api(
    `/demandes/${demande.id}/produits/${demande.produits[1].id}/validation`,
    { method: "PATCH", body: JSON.stringify({ statut_validation: "approuve" }) },
    jetonCommercial,
  );
  verifier(d2.statut === 200, `produit B approuvé (${d2.statut})`);
  verifier(d2.corps?.date_validation != null, "date_validation renseignée");

  // La demande reste en attente tant qu'il reste un produit non tranché
  const intermediaire = await api(`/demandes/${demande.id}`, {}, jetonCommercial);
  verifier(intermediaire.corps?.statut === "en_attente", "demande toujours en_attente après 2 décisions");

  const d3 = await api(
    `/demandes/${demande.id}/produits/${demande.produits[2].id}/validation`,
    { method: "PATCH", body: JSON.stringify({ statut_validation: "approuve" }) },
    jetonCommercial,
  );
  verifier(d3.statut === 200, `produit C approuvé (${d3.statut})`);

  // 7. Statut dérivé : mixte (A refusé) → rejetee
  const finale = await api(`/demandes/${demande.id}`, {}, jetonCommercial);
  verifier(finale.corps?.statut === "rejetee", `demande dérivée en rejetee (${finale.corps?.statut})`);
  verifier(finale.corps?.date_traitement != null, "date_traitement renseignée");

  // 8. Planification de la réception
  const planif = await api(
    `/demandes/${demande.id}/planification`,
    { method: "PATCH", body: JSON.stringify({ date_reception_prevue: "2026-09-01T09:00:00Z" }) },
    jetonCommercial,
  );
  verifier(planif.statut === 200 && planif.corps?.ok === true, `planification acceptée (${planif.statut})`);

  // 9. Décharge générable car au moins un produit approuvé (B et C)
  const decharge = await api(
    "/decharges/generate",
    { method: "POST", body: JSON.stringify({ demande_id: demande.id }) },
    jetonCommercial,
  );
  verifier(decharge.statut === 201 || decharge.statut === 200, `décharge générée (${decharge.statut})`);
  if (decharge.corps?.id) {
    const pdf = await fetch(`${BASE}/decharges/${decharge.corps.id}/pdf`, {
      headers: { Authorization: `Bearer ${jetonCommercial}` },
    });
    verifier(pdf.status === 200 && (await pdf.arrayBuffer()).byteLength > 10000, `PDF téléchargé (${pdf.status})`);
  }

  // 10. Demande 100 % approuvée → approuvee
  const creation2 = await api(
    "/demandes",
    {
      method: "POST",
      body: JSON.stringify({
        produits: [
          { sku_code: "P3-D", designation: "Produit D", longueur_cm: 15, largeur_cm: 15, hauteur_cm: 15, poids_kg: 4, fragile: false, type_emballage: "carton", quantite: 7 },
        ],
      }),
    },
    jetonExpediteur,
  );
  const demande2 = creation2.corps;
  await api(
    `/demandes/${demande2.id}/produits/${demande2.produits[0].id}/validation`,
    { method: "PATCH", body: JSON.stringify({ statut_validation: "approuve" }) },
    jetonCommercial,
  );
  const finale2 = await api(`/demandes/${demande2.id}`, {}, jetonCommercial);
  verifier(finale2.corps?.statut === "approuvee", `demande 100% approuvée → approuvee (${finale2.corps?.statut})`);

  // 11. La file d'attente ne contient plus ces demandes traitées
  const file2 = await api("/demandes?attente=1", {}, jetonCommercial);
  verifier(!file2.corps?.some((d) => d.id === demande.id), "demande sortie de la file après traitement");

  console.log(process.exitCode ? "\n== ECHECS DETECTES ==" : "\n== TOUS LES TESTS PASSENT ==");
};

principal().catch((erreur) => {
  console.error("**ERREUR FATALE**", erreur);
  process.exitCode = 1;
});
