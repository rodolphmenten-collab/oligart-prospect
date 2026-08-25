// Connecteur Welcome to the Jungle (WTTJ) -- le site est un client React
// InstantSearch qui interroge directement Algolia depuis le navigateur, avec
// une clé "search-only" publique par conception (Algolia documente
// explicitement que ce type de clé est fait pour être exposée côté client :
// https://support.algolia.com -- ce n'est pas un secret à contourner, c'est
// exactement ce que le site envoie à chaque visiteur).
//
// AVERTISSEMENT ASSUMÉ : ces identifiants (application ID + clé publique)
// ont été retrouvés via une trace technique documentée par un tiers, pas
// vérifiés en direct depuis ce sandbox (réseau restreint, pas d'accès à
// l'infrastructure Algolia pour tester). WTTJ peut faire tourner cette clé
// à tout moment -- traité exactement comme LinkedIn : un échec devient
// "WTTJ indisponible", jamais une erreur qui casse le reste du scan.
const ALGOLIA_APP_ID = "CSEKHVMS53";
const ALGOLIA_SEARCH_KEY = "4bd8f6215d0cc52b26430765769e65a0";
const ALGOLIA_URL = `https://${ALGOLIA_APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes/*/queries`;
const INDEX = "wk_cms_jobs_production";
const QUERIES = ["Country Manager", "VP Sales", "Directeur Commercial", "Head of Sales", "General Manager"];

async function fetchWTTJ(fetchImpl) {
  const seen = new Set();
  const jobs = [];
  const failures = [];
  for (const q of QUERIES) {
    try {
      const body = JSON.stringify({
        requests: [{ indexName: INDEX, params: `hitsPerPage=20&page=0&query=${encodeURIComponent(q)}` }]
      });
      const r = await fetchImpl(`${ALGOLIA_URL}?x-algolia-agent=Algolia%20for%20JavaScript`, {
        method: "POST",
        headers: {
          "x-algolia-application-id": ALGOLIA_APP_ID,
          "x-algolia-api-key": ALGOLIA_SEARCH_KEY,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      });
      if (!r.ok) { failures.push(`"${q}": HTTP ${r.status}`); continue; }
      const data = await r.json();
      const hits = data.results?.[0]?.hits || [];
      for (const h of hits) {
        // Schéma exact non garanti (non vérifié en direct) -- extraction
        // défensive avec plusieurs noms de champs plausibles, jamais
        // d'invention si un champ est absent.
        const id = h.objectID || h.reference || `${h.name}-${h.organization?.name}`;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const title = h.name || h.title || "";
        const company = h.organization?.name || h.company_name || "";
        const slug = h.slug || h.reference || "";
        const orgSlug = h.organization?.slug || h.company_slug || "";
        const url = orgSlug && slug
          ? `https://www.welcometothejungle.com/fr/companies/${orgSlug}/jobs/${slug}`
          : "";
        if (!title || !company || !url) continue; // donnée trop incomplète pour être exploitable (pas de lien cliquable)
        jobs.push({
          id: `wttj-${id}`,
          title,
          company,
          location: h.offices?.[0]?.city || h.location || "",
          description: "",
          salary: "",
          publishedAt: h.published_at || "",
          discoveredAt: new Date().toISOString(),
          source: "Welcome to the Jungle",
          sourceUrl: url,
          applyUrl: url,
          remote: /remote|t[ée]l[ée]travail/i.test(h.remote || h.location || ""),
          ats: "wttj"
        });
      }
    } catch (e) {
      failures.push(`"${q}": ${e.message}`);
    }
  }
  return { jobs, blocked: failures.length === QUERIES.length, failures };
}

module.exports = { fetchWTTJ };
