// Trouve automatiquement le décideur qui gère le budget media/pub (Directeur
// Marketing, Directeur Media, Head of Digital...) via l'API Hunter.io
// "Domain Search" (liste toutes les personnes connues sur un domaine avec
// leur poste), contrairement à l'Email Finder qui cherche un nom déjà connu.
// Nécessite HUNTER_API_KEY (plan gratuit disponible).
//
// Hunter ne fournit pas toujours le lien LinkedIn (champ souvent vide même
// quand nom/email/poste sont connus). Quand c'est le cas, une recherche web
// réelle via Tavily (tier gratuit permanent, 1000 crédits/mois, inscriptions
// ouvertes -- contrairement à Google Custom Search qui est fermé aux
// nouveaux comptes depuis 2026) complète automatiquement le profil,
// restreinte au domaine linkedin.com. Optionnelle : sans TAVILY_API_KEY,
// le LinkedIn reste simplement vide comme avant, jamais bloquant.
//
// Honnêteté : ne renvoie que des personnes réellement trouvées par Hunter,
// et un lien LinkedIn seulement si Tavily a un résultat qui matche
// clairement le nom (jamais un lien deviné ou approximatif). Si personne
// au poste recherché n'est trouvé sur le domaine, found:false avec la raison.
const TARGET_ROLE_RE = /marketing|digital|m[ée]dia\b|media\b|communication|brand|acquisition|growth|publicit|advertis/i;
const EXCLUDE_ROLE_RE = /\bceo\b|chief executive|founder|fondateur|pr[ée]sident|head of sales|sales director|directeur commercial|vp sales|account executive/i;

async function findLinkedinUrl(fetchImpl, name, company) {
  if (!process.env.TAVILY_API_KEY || !name) return "";
  try {
    const r = await fetchImpl("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify({ query: `${name} ${company} LinkedIn`, max_results: 5, include_domains: ["linkedin.com"] })
    });
    if (!r.ok) return "";
    const data = await r.json();
    // Le nom de famille doit apparaître dans l'URL ou le titre du résultat
    // pour être retenu -- évite de renvoyer un homonyme ou un profil sans
    // rapport plutôt qu'un lien deviné.
    const lastName = name.trim().split(/\s+/).pop()?.toLowerCase() || "";
    const hit = (data.results || []).find(x =>
      /linkedin\.com\/in\//.test(x.url) && lastName && (x.url.toLowerCase().includes(lastName) || (x.title || "").toLowerCase().includes(lastName))
    );
    return hit ? hit.url : "";
  } catch {
    return ""; // une recherche LinkedIn ratée ne doit jamais faire échouer tout l'enrichissement
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée" }) };
  }
  try {
    const { company, domain } = JSON.parse(event.body || "{}");
    if (!company && !domain) {
      return { statusCode: 400, body: JSON.stringify({ error: "Entreprise ou domaine requis" }) };
    }
    if (!process.env.HUNTER_API_KEY) {
      return { statusCode: 501, body: JSON.stringify({ error: "HUNTER_API_KEY non configurée sur Netlify" }) };
    }
    // limit=10 : plafond du plan gratuit Hunter (25 recherches/mois, 10
    // emails max par recherche de domaine). Une valeur plus haute déclenche
    // une erreur explicite côté Hunter plutôt qu'une troncature silencieuse
    // -- corrigé après l'avoir vu se produire en conditions réelles.
    const params = new URLSearchParams({ api_key: process.env.HUNTER_API_KEY, limit: "10" });
    if (domain) params.set("domain", domain);
    else params.set("company", company);

    const r = await fetch(`https://api.hunter.io/v2/domain-search?${params.toString()}`);
    const data = await r.json();
    if (!r.ok) {
      return { statusCode: r.status, body: JSON.stringify({ error: data.errors?.[0]?.details || "Erreur API Hunter" }) };
    }
    const emails = data.data?.emails || [];
    const candidates = emails
      .filter(e => e.position && TARGET_ROLE_RE.test(e.position) && !EXCLUDE_ROLE_RE.test(e.position))
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    if (!candidates.length) {
      return { statusCode: 200, body: JSON.stringify({ found: false, reason: "Aucun contact marketing/digital/media trouvé sur ce domaine via Hunter" }) };
    }

    async function toContact(e) {
      const name = [e.first_name, e.last_name].filter(Boolean).join(" ") || "";
      let linkedin = e.linkedin || "";
      if (!linkedin) linkedin = await findLinkedinUrl(fetch, name, company || domain);
      return { name, role: e.position || "", email: e.value, linkedin, confidence: e.confidence };
    }

    const contact1 = await toContact(candidates[0]);
    const contact2 = candidates[1] ? await toContact(candidates[1]) : null;

    return { statusCode: 200, body: JSON.stringify({ found: true, contact1, contact2 }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Erreur serveur" }) };
  }
};
