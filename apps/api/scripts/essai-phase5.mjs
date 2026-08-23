// Test E2E Phase 5 : module admin (stats, gestion expéditeurs, blocage suspension).
// Usage : node scripts/essai-phase5.mjs <URL_API>
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
  const jetonAdmin = await connexion("admin@navex.dz");
  const jetonExpediteur = await connexion("expediteur@navex.dz");
  const jetonCommercial = await connexion("commercial@navex.dz");
  verifier(!!jetonAdmin && !!jetonExpediteur && !!jetonCommercial, "connexions");

  // ── RBAC : seuls les admins accèdent au module ──
  const refus1 = await api("/admin/stats", {}, jetonExpediteur);
  verifier(refus1.statut === 403, `expéditeur bloqué sur /admin/stats (${refus1.statut})`);
  const refus2 = await api("/admin/expediteurs", {}, jetonCommercial);
  verifier(refus2.statut === 403, `agent commercial bloqué sur /admin/expediteurs (${refus2.statut})`);

  // ── Stats globales ──
  const stats = await api("/admin/stats", {}, jetonAdmin);
  verifier(stats.statut === 200, `stats accessibles (${stats.statut})`);
  verifier(typeof stats.corps?.produits_en_attente === "number", "produits_en_attente numérique");
  verifier(
    stats.corps?.demandes_par_statut && "en_attente" in stats.corps.demandes_par_statut,
    "demandes par statut complètes",
  );
  verifier(stats.corps?.emplacements?.total >= 36, `emplacements comptés (${stats.corps?.emplacements?.total})`);

  // ── Liste des expéditeurs ──
  const expediteurs = await api("/admin/expediteurs", {}, jetonAdmin);
  verifier(expediteurs.statut === 200 && Array.isArray(expediteurs.corps), "liste des expéditeurs");
  const sarl = expediteurs.corps.find((e) => e.email === "contact@sarl-boumerdes.dz");
  verifier(!!sarl, "expéditeur SARL trouvé");
  verifier(sarl?.statut === "actif", `statut initial actif (${sarl?.statut})`);
  verifier(typeof sarl?.nb_demandes === "number" && sarl.nb_demandes > 0, `compteur demandes (${sarl?.nb_demandes})`);

  // ── Suspension → création de demande bloquée pour TOUTE l'entreprise ──
  const suspension = await api(
    `/admin/expediteurs/${sarl.id}/statut`,
    { method: "PATCH", body: JSON.stringify({ statut: "suspendu" }) },
    jetonAdmin,
  );
  verifier(suspension.statut === 200 && suspension.corps?.ok === true, `expéditeur suspendu (${suspension.statut})`);

  const demandeBloquee = await api(
    "/demandes",
    {
      method: "POST",
      body: JSON.stringify({
        produits: [
          { sku_code: "P5-X", designation: "Bloqué", longueur_cm: 10, largeur_cm: 10, hauteur_cm: 10, poids_kg: 1, fragile: false, type_emballage: "carton", quantite: 1 },
        ],
      }),
    },
    jetonExpediteur,
  );
  verifier(
    demandeBloquee.statut === 403 && demandeBloquee.corps?.code === "erreurs.expediteur_suspendu",
    `création refusée pendant la suspension (${demandeBloquee.statut})`,
  );

  // Statut identique → conflit explicite
  const doublon = await api(
    `/admin/expediteurs/${sarl.id}/statut`,
    { method: "PATCH", body: JSON.stringify({ statut: "suspendu" }) },
    jetonAdmin,
  );
  verifier(doublon.statut === 409 && doublon.corps?.code === "erreurs.statut_deja_actuel", `re-suspension rejetée (${doublon.statut})`);

  // Statut invalide → 400 (ValidationPipe)
  const invalide = await api(
    `/admin/expediteurs/${sarl.id}/statut`,
    { method: "PATCH", body: JSON.stringify({ statut: "nimporte" }) },
    jetonAdmin,
  );
  verifier(invalide.statut === 400, `statut invalide rejeté (${invalide.statut})`);

  // ── Réactivation → tout rentre dans l'ordre ──
  const reactivation = await api(
    `/admin/expediteurs/${sarl.id}/statut`,
    { method: "PATCH", body: JSON.stringify({ statut: "actif" }) },
    jetonAdmin,
  );
  verifier(reactivation.statut === 200, `expéditeur réactivé (${reactivation.statut})`);

  const creationOk = await api(
    "/demandes",
    {
      method: "POST",
      body: JSON.stringify({
        produits: [
          { sku_code: "P5-A", designation: "Après réactivation", longueur_cm: 10, largeur_cm: 10, hauteur_cm: 10, poids_kg: 1, fragile: false, type_emballage: "carton", quantite: 3 },
        ],
      }),
    },
    jetonExpediteur,
  );
  verifier(creationOk.statut === 201 || creationOk.statut === 200, `création à nouveau possible (${creationOk.statut})`);

  // ── Comptes utilisateurs ──
  const comptes = await api("/admin/utilisateurs", {}, jetonAdmin);
  verifier(comptes.statut === 200 && comptes.corps.length >= 4, `${comptes.corps?.length} comptes listés`);
  const entrepotCompte = comptes.corps.find((u) => u.email === "entrepot@navex.dz");
  verifier(entrepotCompte?.role === "agent_entrepot", "rôle correct sur le compte entrepôt");
  verifier(entrepotCompte?.actif === true, "compte actif signalé");

  console.log(process.exitCode ? "\n== ECHECS DETECTES ==" : "\n== TOUS LES TESTS PASSENT ==");
};

principal().catch((erreur) => {
  console.error("**ERREUR FATALE**", erreur);
  process.exitCode = 1;
});
