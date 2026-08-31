// Connecteur APEC -- apec.fr est une SPA React qui ne renvoie qu'une coquille
// vide en requête HTTP simple ("Une erreur inattendue est survenue", vérifié
// à plusieurs reprises), impossible à interroger directement. Contournement :
// Tavily (déjà configuré pour la recherche de contacts, réutilisé ici) a
// indexé les pages d'offres publiques d'apec.fr indépendamment du JS du
// site -- une recherche restreinte à ce domaine retrouve donc les annonces
// sans dépendre du bon fonctionnement de la recherche interne d'APEC.
//
// Honnêteté : le format des pages APEC ne sépare pas aussi proprement
// titre/entreprise que LinkedIn -- company reste "Voir l'annonce" quand
// l'extraction n'est pas fiable, jamais un nom deviné.
const TARGET_QUERIES = [
  "General Manager Country Manager",
  "Directeur Commercial VP Sales",
  "Head of Sales Directeur Général"
];

function extractCompanyFromApec(title, content) {
  // Formats fréquents : "Offre d'emploi [Titre] - [Entreprise] | Apec" ou
  // "[Titre] H/F - [Entreprise]". Extraction best-effort, jamais forcée.
  const m = (title || "").match(/-\s*([A-ZÀ-Ü][\w&.\- ]{2,40})\s*(\||$)/);
  if (m) return m[1].trim();
  const m2 = (content || "").match(/chez\s+([A-ZÀ-Ü][\w&.\- ]{2,40})/);
  if (m2) return m2[1].trim();
  return "Voir l'annonce";
}

async function fetchApecViaTavily(fetchImpl) {
  if (!process.env.TAVILY_API_KEY) return { jobs: [], skipped: true };
  const seen = new Set();
  const jobs = [];
  const failures = [];
  for (const q of TARGET_QUERIES) {
    try {
      const r = await fetchImpl("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
        body: JSON.stringify({ query: `${q} France recrutement`, max_results: 10, include_domains: ["apec.fr"], search_depth: "advanced" })
      });
      if (!r.ok) { failures.push(`"${q}": HTTP ${r.status}`); continue; }
      const data = await r.json();
      for (const hit of data.results || []) {
        if (!/apec\.fr/.test(hit.url) || seen.has(hit.url)) continue;
        if (/Une erreur inattendue/i.test(hit.content || "")) continue; // page coquille vide, pas une vraie offre
        seen.add(hit.url);
        jobs.push({
          id: `apec-${Buffer.from(hit.url).toString("base64").slice(0, 24)}`,
          title: (hit.title || "").replace(/\s*\|\s*Apec.*$/i, "").replace(/^Offres? d'emploi\s*/i, "").replace(/\s*-\s*[A-ZÀ-Ü][\w&.\- ]{2,40}\s*$/, "").trim(),
          company: extractCompanyFromApec(hit.title, hit.content),
          location: "",
          description: (hit.content || "").slice(0, 2000),
          salary: "",
          publishedAt: "",
          discoveredAt: new Date().toISOString(),
          source: "APEC",
          sourceUrl: hit.url,
          applyUrl: hit.url,
          remote: /remote|t[ée]l[ée]travail/i.test(hit.content || ""),
          ats: "apec"
        });
      }
    } catch (e) {
      failures.push(`"${q}": ${e.message}`);
    }
  }
  return { jobs, skipped: false, blocked: jobs.length === 0 && failures.length === TARGET_QUERIES.length, failures };
}

module.exports = { fetchApecViaTavily };
