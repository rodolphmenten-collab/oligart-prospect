// Trouve automatiquement le décideur qui gère le budget media/pub (Directeur
// Marketing, Directeur Media, Head of Digital...) via l'API Hunter.io
// "Domain Search" (liste toutes les personnes connues sur un domaine avec
// leur poste), contrairement à l'Email Finder qui cherche un nom déjà connu.
// Nécessite HUNTER_API_KEY (plan gratuit disponible).
//
// Honnêteté : ne renvoie que des personnes réellement trouvées par Hunter,
// jamais un nom deviné. Si personne au poste recherché n'est trouvé sur le
// domaine, found:false avec la raison.
const TARGET_ROLE_RE = /marketing|digital|m[ée]dia\b|media\b|communication|brand|acquisition|growth|publicit|advertis/i;
const EXCLUDE_ROLE_RE = /\bceo\b|chief executive|founder|fondateur|pr[ée]sident|head of sales|sales director|directeur commercial|vp sales|account executive/i;

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
    const params = new URLSearchParams({ api_key: process.env.HUNTER_API_KEY, limit: "20" });
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

    const toContact = e => ({
      name: [e.first_name, e.last_name].filter(Boolean).join(" ") || "",
      role: e.position || "",
      email: e.value,
      linkedin: e.linkedin || "",
      confidence: e.confidence
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        found: true,
        contact1: toContact(candidates[0]),
        contact2: candidates[1] ? toContact(candidates[1]) : null
      })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Erreur serveur" }) };
  }
};
