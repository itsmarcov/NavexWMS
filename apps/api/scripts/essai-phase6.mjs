// Test E2E Phase 6 : création d'utilisateurs/expéditeurs par admin et commercial.
// Usage : node scripts/essai-phase6.mjs <URL_API>
const BASE = process.argv[2] ?? "http://localhost:3001/api";

async function api(chemin, options = {}, token = null) {
  const reponse = await fetch(`${BASE}${chemin}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const corps = await reponse.json().catch(() => null);
  return { statut: reponse.status, corps };
}

function verifier(condition, libelle) {
  console.log(`${condition ? "OK" : "**ECHEC**"} - ${libelle}`);
  if (!condition) process.exitCode = 1;
}

const connexion = async (email) =>
  (await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password: "Test@1234" }) })).corps?.access_token;

const principal = async () => {
  const jetonAdmin = await connexion("admin@navex.dz");
  const jetonCommercial = await connexion("commercial@navex.dz");
  const jetonEntrepot = await connexion("entrepot@navex.dz");
  verifier(!!jetonAdmin && !!jetonCommercial && !!jetonEntrepot, "connexions");

  // ── RBAC : seul l'admin crée des comptes utilisateurs ──
  const refusCompte = await api("/admin/utilisateurs", { method: "POST", body: JSON.stringify({ email: "x@test.dz", mot_de_passe: "Test@123456", role: "agent_entrepot" }) }, jetonCommercial);
  verifier(refusCompte.statut === 403, `commercial bloqué sur POST /admin/utilisateurs (${refusCompte.statut})`);
  const refusCompte2 = await api("/admin/utilisateurs", { method: "POST", body: JSON.stringify({ email: "x@test.dz", mot_de_passe: "Test@123456", role: "agent_entrepot" }) }, jetonEntrepot);
  verifier(refusCompte2.statut === 403, `entrepôt bloqué sur POST /admin/utilisateurs (${refusCompte2.statut})`);

  // ── Admin crée un agent entrepôt ──
  const emailAgent = `agent-test-${Date.now()}@navex.dz`;
  const creerAgent = await api("/admin/utilisateurs", { method: "POST", body: JSON.stringify({ email: emailAgent, mot_de_passe: "Test@123456", role: "agent_entrepot" }) }, jetonAdmin);
  verifier(creerAgent.statut === 201, `agent entrepôt créé (${creerAgent.statut})`);
  verifier(creerAgent.corps?.role === "agent_entrepot", `rôle correct (${creerAgent.corps?.role})`);

  // Email dupliqué → 409
  const doublon = await api("/admin/utilisateurs", { method: "POST", body: JSON.stringify({ email: emailAgent, mot_de_passe: "Test@123456", role: "agent_entrepot" }) }, jetonAdmin);
  verifier(doublon.statut === 409, `email dupliqué rejeté (${doublon.statut})`);

  // ── Admin crée un expéditeur ──
  const emailExp = `exp-test-${Date.now()}@test.dz`;
  const creerExp = await api("/admin/expediteurs", { method: "POST", body: JSON.stringify({ nom_entreprise: "Test E2E", email: emailExp, telephone: "0555000000", adresse: "Alger" }) }, jetonAdmin);
  verifier(creerExp.statut === 201, `expéditeur créé par admin (${creerExp.statut})`);
  verifier(creerExp.corps?.statut === "actif", `statut actif (admin crée directement actif) (${creerExp.corps?.statut})`);
  verifier(!!creerExp.corps?.mot_de_passe_defaut, `mot de passe défaut renvoyé`);

  // ── Commercial crée un expéditeur ──
  const emailExp2 = `exp-test2-${Date.now()}@test.dz`;
  const creerExp2 = await api("/admin/expediteurs", { method: "POST", body: JSON.stringify({ nom_entreprise: "Test E2E Commercial", email: emailExp2, telephone: "0555111111", adresse: "Oran" }) }, jetonCommercial);
  verifier(creerExp2.statut === 201, `expéditeur créé par commercial (${creerExp2.statut})`);
  verifier(creerExp2.corps?.statut === "en_attente", `statut en_attente (commercial crée en attente) (${creerExp2.corps?.statut})`);

  // ── Le nouveau compte expéditeur peut se connecter ──
  const jetonNouveauExp = await api("/auth/login", { method: "POST", body: JSON.stringify({ email: emailExp, password: "Navex@2026" }) });
  verifier(jetonNouveauExp.statut === 201 || !!jetonNouveauExp.corps?.access_token, `login avec mot de passe par défaut`);

  // ── Le nouveau compte agent peut se connecter ──
  const jetonNouveauAgent = await api("/auth/login", { method: "POST", body: JSON.stringify({ email: emailAgent, password: "Test@123456" }) });
  verifier(jetonNouveauAgent.statut === 201 || !!jetonNouveauAgent.corps?.access_token, `login agent avec mot de passe choisi`);

  // ── Vérification : le nouvel expéditeur apparaît dans la liste admin ──
  const listeExp = await api("/admin/expediteurs", {}, jetonAdmin);
  verifier(listeExp.corps?.some((e) => e.email === emailExp), `nouvel expéditeur dans la liste admin`);
  verifier(listeExp.corps?.some((e) => e.email === emailExp2), `nouvel expéditeur commercial dans la liste admin`);

  // ══════════════════════════════════════════════════════════════
  // PHASE 6B : Modification + Suppression
  // ══════════════════════════════════════════════════════════════

  // ── Modifier un expéditeur ──
  const expAmodifier = listeExp.corps?.find((e) => e.email === emailExp);
  verifier(!!expAmodifier, `expéditeur à modifier trouvé`);

  const modifExp = await api(`/admin/expediteurs/${expAmodifier.id}`, { method: "PATCH", body: JSON.stringify({ nom_entreprise: "Test E2E Modifié", telephone: "0555999999" }) }, jetonAdmin);
  verifier(modifExp.statut === 200, `expéditeur modifié (${modifExp.statut})`);
  verifier(modifExp.corps?.nom_entreprise === "Test E2E Modifié", `nom mis à jour (${modifExp.corps?.nom_entreprise})`);

  // ── Modifier un utilisateur ──
  const listeUsers = await api("/admin/utilisateurs", {}, jetonAdmin);
  const userAmodifier = listeUsers.corps?.find((u) => u.email === emailAgent);
  verifier(!!userAmodifier, `utilisateur à modifier trouvé`);

  const modifUser = await api(`/admin/utilisateurs/${userAmodifier.id}`, { method: "PATCH", body: JSON.stringify({ role: "agent_commercial" }) }, jetonAdmin);
  verifier(modifUser.statut === 200, `utilisateur modifié (${modifUser.statut})`);
  verifier(modifUser.corps?.role === "agent_commercial", `rôle changé (${modifUser.corps?.role})`);

  // ── Supprimer l'expéditeur sans demandes ──
  const expAsupprimer = listeExp.corps?.find((e) => e.email === emailExp);
  const supprExp = await api(`/admin/expediteurs/${expAsupprimer.id}`, { method: "DELETE" }, jetonAdmin);
  verifier(supprExp.statut === 200, `expéditeur supprimé (${supprExp.statut})`);

  // Vérifier qu'il n'apparaît plus
  const listeApresSuppr = await api("/admin/expediteurs", {}, jetonAdmin);
  verifier(!listeApresSuppr.corps?.some((e) => e.email === emailExp), `expéditeur supprimé de la liste`);

  // ── Supprimer l'utilisateur créé ──
  const userAsupprimer = (await api("/admin/utilisateurs", {}, jetonAdmin)).corps?.find((u) => u.email === emailAgent);
  const supprUser = await api(`/admin/utilisateurs/${userAsupprimer.id}`, { method: "DELETE" }, jetonAdmin);
  verifier(supprUser.statut === 200, `utilisateur supprimé (${supprUser.statut})`);

  // ── RBAC : commercial ne peut PAS modifier/supprimer ──
  const modifRefus = await api(`/admin/expediteurs/${expAmodifier.id}`, { method: "PATCH", body: JSON.stringify({ nom_entreprise: "Hack" }) }, jetonCommercial);
  verifier(modifRefus.statut === 403, `commercial bloqué sur PATCH /admin/expediteurs (${modifRefus.statut})`);
  const supprRefus = await api(`/admin/expediteurs/${expAmodifier.id}`, { method: "DELETE" }, jetonCommercial);
  verifier(supprRefus.statut === 403, `commercial bloqué sur DELETE /admin/expediteurs (${supprRefus.statut})`);

  console.log(process.exitCode ? "\n== ECHECS DETECTES ==" : "\n== TOUS LES TESTS PASSENT ==");
};

principal().catch((erreur) => { console.error("**ERREUR FATALE**", erreur); process.exitCode = 1; });
