// Connecteur LinkedIn (offres) via Tavily -- complète _career-linkedin.js
// (scraping direct de l'endpoint invité, fragile et vite bloqué par
// LinkedIn) par une seconde méthode plus robuste : Tavily a indexé les
// pages d'offres LinkedIn publiques indépendamment de tout endpoint
// LinkedIn, donc pas soumis aux mêmes limites anti-scraping.
//
// Deux formats de titre réels confirmés (vérifiés via recherche, pas
// supposés) :
// 1. "[Entreprise] hiring [Titre] in [Lieu] | LinkedIn"
// 2. "[Entreprise] recrute pour des postes de [Titre] ([Lieu]) | LinkedIn"
//    (variante localisée FR)
//
// Bug réel corrigé : du texte parasite type "20 hours ago" / "il y a 3
// jours" pouvait se glisser dans le lieu extrait, ce qui polluait aussi le
// fingerprint de déduplication -- une même offre réapparaissait à chaque
// scan comme "nouvelle" au lieu d'être reconnue comme déjà connue,
// produisant les doublons vus en conditions réelles. Nettoyage systématique
// + rejet si le nom d'entreprise extrait ressemble à un lieu/horodatage
// plutôt qu'à un vrai nom d'entreprise.
const TARGET_QUERIES = [
  "General Manager Country Manager",
  "Directeur Commercial VP Sales",
  "Head of Sales Directeur Général"
];

const AGO_SUFFIX_RE = /\s*\d+\s*(hours?|days?|weeks?|months?)\s*ago\s*$|\s*il y a\s*\d+\s*(heures?|jours?|semaines?|mois)\s*$/i;
const LOOKS_LIKE_NOISE_RE = /\d+\s*(hours?|days?|weeks?|months?)\s*ago|il y a\s*\d+\s*(heures?|jours?|semaines?|mois)/i;
const AGO_CAPTURE_RE = /(\d+)\s*(hour|day|week|month)s?\s*ago|il y a\s*(\d+)\s*(heures?|jours?|semaines?|mois)/i;

function clean(s) {
  return (s || "").replace(AGO_SUFFIX_RE, "").replace(/\s+/g, " ").trim();
}

// Le texte "20 hours ago" / "il y a 3 jours", auparavant seulement rejeté
// comme bruit, contient une vraie info de date de publication -- exploitée
// ici pour calculer un publishedAt approximatif plutôt que de la perdre.
function extractPublishedAt(text) {
  const m = (text || "").match(AGO_CAPTURE_RE);
  if (!m) return "";
  const n = Number(m[1] || m[3]);
  const unitRaw = (m[2] || m[4] || "").toLowerCase();
  const msPerUnit = /hour/.test(unitRaw) || /heure/.test(unitRaw) ? 3600000
    : /day/.test(unitRaw) || /jour/.test(unitRaw) ? 86400000
    : /week/.test(unitRaw) || /semaine/.test(unitRaw) ? 604800000
    : /month/.test(unitRaw) || /mois/.test(unitRaw) ? 2629800000
    : 0;
  if (!n || !msPerUnit) return "";
  return new Date(Date.now() - n * msPerUnit).toISOString();
}

function parseLinkedinJobTitle(title) {
  const t = title || "";
  let m = t.match(/^(.+?)\s+hiring\s+(.+?)\s+in\s+(.+?)\s*\|\s*LinkedIn/i);
  if (m) return { company: clean(m[1]), title: clean(m[2]), location: clean(m[3]) };
  m = t.match(/^(.+?)\s+recrute pour des postes de\s+(.+?)\s*\((.+?)\)\s*\|\s*LinkedIn/i);
  if (m) return { company: clean(m[1]), title: clean(m[2]), location: clean(m[3]) };
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
        // Garde-fou : si le nom d'entreprise extrait est identique au lieu,
        // c'est que le titre n'a pas été découpé correctement (le même
        // texte a été capturé deux fois) -- rejeté plutôt qu'affiché comme
        // une fausse "entreprise" qui est en réalité une adresse.
        if (!parsed.company || !parsed.title || parsed.company === parsed.location || LOOKS_LIKE_NOISE_RE.test(parsed.company)) continue;
        seen.add(hit.url);
        jobs.push({
          id: `linkedin-tavily-${Buffer.from(hit.url).toString("base64").slice(0, 24)}`,
          title: parsed.title,
          company: parsed.company,
          location: parsed.location,
          description: (hit.content || "").slice(0, 2000),
          salary: "",
          publishedAt: extractPublishedAt(hit.title) || extractPublishedAt(hit.content),
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
