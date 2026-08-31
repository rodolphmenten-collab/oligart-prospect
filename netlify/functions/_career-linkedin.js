// Connecteur LinkedIn -- endpoint "invité" public documenté publiquement
// (https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search),
// utilisé par LinkedIn lui-même pour afficher des résultats aux visiteurs
// non connectés. Aucun login, aucun cookie personnel, aucun contournement
// de protection : c'est la même requête qu'un navigateur anonyme envoie.
//
// AVERTISSEMENT ASSUMÉ : cet endpoint n'est pas officiellement documenté par
// LinkedIn et peut bloquer après quelques requêtes depuis la même IP (limite
// observée autour de la 10e page selon plusieurs guides indépendants). Une
// seule page par requête ciblée est donc demandée ici (pas de pagination
// agressive), et un échec/blocage est traité comme "zéro résultat", jamais
// comme une erreur qui casserait le scan global (cohérent avec le principe
// de résilience Promise.allSettled du reste de l'app).
const SEARCH_URL = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
const QUERIES = ["Country Manager", "VP Sales", "Directeur Commercial", "Head of Sales", "Chief Business Officer", "VP Partnerships Business Development"];
const LOCATION = "France";

function parseJobCards(html) {
  const jobs = [];
  // Chaque offre est un <li> avec un lien /jobs/view/{id}, un h3 (titre) et
  // un h4 (entreprise) -- structure stable documentée par plusieurs guides
  // indépendants (pas une supposition). Extraction par regex tolérante :
  // en cas de structure inattendue, on ignore simplement l'entrée plutôt
  // que d'inventer des champs manquants.
  const cardRe = /<li>[\s\S]*?<\/li>/g;
  const cards = html.match(cardRe) || [];
  for (const card of cards) {
    const idMatch = card.match(/data-entity-urn="urn:li:jobPosting:(\d+)"/);
    const urlMatch = card.match(/href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^"?]+)/);
    const titleMatch = card.match(/<h3[^>]*class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/);
    const companyMatch = card.match(/<h4[^>]*class="base-search-card__subtitle"[^>]*>[\s\S]*?>([\s\S]*?)<\/a>/);
    const locationMatch = card.match(/<span[^>]*class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/);
    if (!idMatch || !titleMatch) continue;
    const clean = s => (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    jobs.push({
      id: `linkedin-${idMatch[1]}`,
      title: clean(titleMatch[1]),
      company: clean(companyMatch?.[1]) || "Entreprise non précisée",
      location: clean(locationMatch?.[1]),
      description: "", // non fournie par cet endpoint de recherche (nécessiterait une 2e requête par offre)
      salary: "",
      publishedAt: "",
      discoveredAt: new Date().toISOString(),
      source: "LinkedIn",
      sourceUrl: urlMatch?.[1] || `https://www.linkedin.com/jobs/view/${idMatch[1]}`,
      applyUrl: urlMatch?.[1] || `https://www.linkedin.com/jobs/view/${idMatch[1]}`,
      remote: /remote|t[ée]l[ée]travail/i.test(clean(locationMatch?.[1])),
      ats: "linkedin"
    });
  }
  return jobs;
}

async function fetchLinkedIn(fetchImpl) {
  const seen = new Set();
  const jobs = [];
  const failures = [];
  for (const q of QUERIES) {
    try {
      const params = new URLSearchParams({ keywords: q, location: LOCATION, start: "0" });
      const r = await fetchImpl(`${SEARCH_URL}?${params.toString()}`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; OligartProspect/1.0)" }
      });
      if (!r.ok) { failures.push(`"${q}": HTTP ${r.status}`); continue; }
      const html = await r.text();
      for (const j of parseJobCards(html)) {
        if (seen.has(j.id)) continue;
        seen.add(j.id);
        jobs.push(j);
      }
    } catch (e) {
      failures.push(`"${q}": ${e.message}`);
    }
  }
  // failures.length === QUERIES.length signifie un blocage complet (IP
  // bannie, endpoint changé...) -- pas une panne de l'app, juste "LinkedIn
  // indisponible" affiché tel quel côté UI.
  return { jobs, blocked: failures.length === QUERIES.length, failures };
}

module.exports = { fetchLinkedIn, parseJobCards };
