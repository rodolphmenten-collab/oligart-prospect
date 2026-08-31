// Connecteur LinkedIn (offres) via Tavily -- complète _career-linkedin.js
// (scraping direct de l'endpoint invité, fragile et vite bloqué par
// LinkedIn) par une seconde méthode plus robuste : Tavily a indexé les
// pages d'offres LinkedIn publiques indépendamment de tout endpoint
// LinkedIn, donc pas soumis aux mêmes limites anti-scraping.
//
// Format typique d'une page d'offre LinkedIn : "[Entreprise] hiring [Titre]
// in [Lieu] | LinkedIn" -- extraction adaptée à ce format précis, jamais
// de nom d'entreprise deviné si le format ne correspond pas.
const TARGET_QUERIES = [
  "General Manager Country Manager",
  "Directeur Commercial VP Sales",
  "Head of Sales Directeur Général"
];

function parseLinkedinJobTitle(title) {
  // "Entreprise hiring Titre in Lieu | LinkedIn"
  const m = (title || "").match(/^(.+?)\s+hiring\s+(.+?)\s+in\s+(.+?)\s*\|\s*LinkedIn/i);
  if (m) return { company: m[1].trim(), title: m[2].trim(), location: m[3].trim() };
  return null;
}

async function fetchLinkedinJobsViaTavily(fetchImpl) {
  if (!process.env.TAVILY_API_KEY) return { jobs: [], skipped: true };
  const seen = new Set();
  const jobs = [];
  const failures = [];
  for (const q of TARGET_QUERIES) {
    try {
      const r = await fetchImpl("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
        body: JSON.stringify({ query: `${q} France`, max_results: 10, include_domains: ["linkedin.com"], search_depth: "advanced" })
      });
      if (!r.ok) { failures.push(`"${q}": HTTP ${r.status}`); continue; }
      const data = await r.json();
      for (const hit of data.results || []) {
        if (!/linkedin\.com\/jobs\/view\//.test(hit.url) || seen.has(hit.url)) continue;
        const parsed = parseLinkedinJobTitle(hit.title);
        if (!parsed) continue; // format inattendu -- rien à extraire de fiable
        seen.add(hit.url);
        jobs.push({
          id: `linkedin-tavily-${Buffer.from(hit.url).toString("base64").slice(0, 24)}`,
          title: parsed.title,
          company: parsed.company,
          location: parsed.location,
          description: (hit.content || "").slice(0, 2000),
          salary: "",
          publishedAt: "",
          discoveredAt: new Date().toISOString(),
          source: "LinkedIn",
          sourceUrl: hit.url,
          applyUrl: hit.url,
          remote: /remote|t[ée]l[ée]travail/i.test(parsed.location),
          ats: "linkedin"
        });
      }
    } catch (e) {
      failures.push(`"${q}": ${e.message}`);
    }
  }
  return { jobs, skipped: false, blocked: jobs.length === 0 && failures.length === TARGET_QUERIES.length, failures };
}

module.exports = { fetchLinkedinJobsViaTavily };
