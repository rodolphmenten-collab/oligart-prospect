// Fonction Netlify : trouve l'email professionnel d'un décideur à partir de
// son nom et de l'entreprise, via l'API Hunter.io Email Finder (nécessite
// HUNTER_API_KEY, plan gratuit disponible : 25 recherches/mois sur hunter.io).
// Hunter résout le domaine à partir du nom d'entreprise (paramètre "company"),
// pas besoin de connaître le domaine exact à l'avance. Si un domaine est
// fourni explicitement (Rodolph le connaît), il est utilisé en priorité,
// plus fiable qu'une résolution automatique par nom.
//
// Honnêteté : si aucune clé n'est configurée ou si Hunter ne trouve rien,
// la fonction renvoie clairement "skipped"/"not_found" — jamais un email
// deviné ou inventé côté serveur.
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée" }) };
  }
  try {
    const { fullName, company, domain } = JSON.parse(event.body || "{}");
    if (!fullName || (!company && !domain)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Nom complet et (entreprise ou domaine) requis" }) };
    }
    if (!process.env.HUNTER_API_KEY) {
      return { statusCode: 501, body: JSON.stringify({ error: "HUNTER_API_KEY non configurée sur Netlify" }) };
    }
    const params = new URLSearchParams({ full_name: fullName, api_key: process.env.HUNTER_API_KEY });
    if (domain) params.set("domain", domain);
    else params.set("company", company);

    const r = await fetch(`https://api.hunter.io/v2/email-finder?${params.toString()}`);
    const data = await r.json();
    if (!r.ok) {
      return { statusCode: r.status, body: JSON.stringify({ error: data.errors?.[0]?.details || "Erreur API Hunter" }) };
    }
    const found = data.data;
    if (!found || !found.email) {
      return { statusCode: 200, body: JSON.stringify({ found: false }) };
    }
    return {
      statusCode: 200,
      body: JSON.stringify({
        found: true,
        email: found.email,
        confidence: found.score,
        verified: found.verification?.status === "valid",
        position: found.position || ""
      })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Erreur serveur" }) };
  }
};
