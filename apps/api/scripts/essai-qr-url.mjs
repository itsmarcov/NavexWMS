// Vérification bout-en-bout de l'URL du QR : garde middleware + scan réel.
const API = "https://navex-wms-api.onrender.com/api";
const WEB = "https://navex-wms-web.onrender.com";

async function api(chemin, options = {}, token = null) {
  const r = await fetch(`${API}${chemin}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  return { statut: r.status, corps: await r.json().catch(() => null) };
}
const verifier = (c, l) => console.log(`${c ? "OK" : "**ECHEC**"} - ${l}`) || (!c && (process.exitCode = 1));

const principal = async () => {
  const jExpediteur = (
    await api("/auth/login", { method: "POST", body: JSON.stringify({ email: "expediteur@navex.dz", password: "Test@1234" }) })
  ).corps.access_token;
  const jEntrepot = (
    await api("/auth/login", { method: "POST", body: JSON.stringify({ email: "entrepot@navex.dz", password: "Test@1234" }) })
  ).corps.access_token;

  const creation = await api("/demandes", {
    method: "POST",
    body: JSON.stringify({
      produits: [
        { sku_code: "P4-C", designation: "Sacs café", longueur_cm: 70, largeur_cm: 40, hauteur_cm: 30, poids_kg: 60, fragile: false, type_emballage: "sac", quantite: 15 },
      ],
    }),
  }, jExpediteur);
  const demande = creation.corps;
  await api(`/demandes/${demande.id}/produits/${demande.produits[0].id}/validation`, {
    method: "POST" === "PATCH" ? "POST" : "PATCH",
    body: JSON.stringify({ statut_validation: "approuve" }),
  }, (await api("/auth/login", { method: "POST", body: JSON.stringify({ email: "commercial@navex.dz", password: "Test@1234" }) })).corps.access_token);

  const decharge = (
    await api("/decharges/generate", { method: "POST", body: JSON.stringify({ demande_id: demande.id }) }, jExpediteur)
  ).corps;
  const urlQrAttendue = `${WEB}/fr/scan?t=${encodeURIComponent(decharge.qr_token)}`;
  console.log(`URL QR construite par le service : ${urlQrAttendue.slice(0, 60)}…`);

  // 1. Sans session → le middleware i18n doit renvoyer vers le login
  const sansSession = await fetch(urlQrAttendue, { redirect: "manual" });
  verifier(
    [301, 302, 307, 308].includes(sansSession.status) &&
      sansSession.headers.get("location")?.includes("/login"),
    `sans session → redirection login (${sansSession.status})`,
  );

  // 2. Avec le cookie de présence → la page se charge
  const avecCookie = await fetch(urlQrAttendue, {
    headers: { Cookie: `navex_access=${jExpediteur}` },
  });
  verifier(avecCookie.status === 200, `page scan accessible avec cookie (${avecCookie.status})`);

  // 3. Le jeton contenu dans cette URL scanne réellement la décharge
  const scan = await api("/entrepot/scan", { method: "POST", body: JSON.stringify({ qr_token: decharge.qr_token }) }, jEntrepot);
  verifier(scan.statut === 201 || scan.statut === 200, `scan du jeton de l'URL (${scan.statut})`);
  verifier(scan.corps?.numero_decharge === decharge.numero_decharge, `décharge ${scan.corps?.numero_decharge} confirmée`);

  console.log(process.exitCode ? "\n== ECHECS ==" : "\n== CHAINE QR COMPLETE VALIDEE ==");
};

principal().catch((e) => {
  console.error("**ERREUR FATALE**", e);
  process.exitCode = 1;
});
