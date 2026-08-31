// Connecteur France Travail (ex-Pôle Emploi) — API officielle, publique et
// gratuite (300k+ offres), authentification OAuth2 client_credentials.
// Nécessite une inscription gratuite sur francetravail.io (comme Hunter.io) :
// FRANCETRAVAIL_CLIENT_ID / FRANCETRAVAIL_CLIENT_SECRET sur Netlify.
// Si absentes, ce connecteur est simplement ignoré (skipped), jamais une
// erreur bloquante -- cohérent avec tous les autres connecteurs optionnels.
const TOKEN_URL = "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire";
const SEARCH_URL = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";
const SCOPE = "api_offresdemploiv2 o2dsoffre";

// Titres ciblés, un par requête (l'API ne fait pas de OR sur motsCles de façon
// fiable) -- une requête par grand groupe de titres pour limiter les appels
// tout en couvrant l'essentiel du profil recherché.
const QUERIES = [
  "General Manager", "Country Manager", "Directeur Général",
  "Directeur Commercial", "VP Sales", "Head of Sales",
  "Chief Revenue Officer", "Sales Director",
  "Chief Business Officer", "Chief Operating Officer",
  "VP Partnerships", "VP Business Development", "Head of Revenue"
];

async function getAccessToken(fetchImpl) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.FRANCETRAVAIL_CLIENT_ID,
    client_secret: process.env.FRANCETRAVAIL_CLIENT_SECRET,
    scope: SCOPE
  });
  const r = await fetchImpl(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error(`France Travail auth: HTTP ${r.status}`);
  const data = await r.json();
  if (!data.access_token) throw new Error("France Travail: pas de token dans la réponse");
  return data.access_token;
}

async function fetchFranceTravail(fetchImpl) {
  if (!process.env.FRANCETRAVAIL_CLIENT_ID || !process.env.FRANCETRAVAIL_CLIENT_SECRET) {
    return { skipped: true, jobs: [] };
  }
  const token = await getAccessToken(fetchImpl);
  const seen = new Set();
  const jobs = [];
  for (const q of QUERIES) {
    const params = new URLSearchParams({ motsCles: q, range: "0-49" });
    const r = await fetchImpl(`${SEARCH_URL}?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    // 204 = aucun résultat pour cette requête -- normal, pas une erreur.
    if (r.status === 204) continue;
    if (!r.ok) { console.warn(`[oligart] France Travail "${q}": HTTP ${r.status}`); continue; }
    const data = await r.json();
    for (const o of data.resultats || []) {
      if (seen.has(o.id)) continue;
      seen.add(o.id);
      jobs.push({
        id: `francetravail-${o.id}`,
        title: o.intitule || "",
        company: o.entreprise?.nom || "Entreprise non précisée",
        location: o.lieuTravail?.libelle || "",
        description: (o.description || "").slice(0, 2000),
        salary: o.salaire?.libelle || "",
        publishedAt: o.dateCreation || "",
        discoveredAt: new Date().toISOString(),
        source: "France Travail",
        sourceUrl: o.origineOffre?.urlOrigine || `https://candidat.francetravail.fr/offres/recherche/detail/${o.id}`,
        applyUrl: o.origineOffre?.urlOrigine || `https://candidat.francetravail.fr/offres/recherche/detail/${o.id}`,
        remote: /t[ée]l[ée]travail|remote/i.test(`${o.intitule} ${o.description || ""}`),
        ats: "francetravail"
      });
    }
  }
  return { skipped: false, jobs };
}

module.exports = { fetchFranceTravail };
