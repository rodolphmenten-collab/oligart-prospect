// Recherche des adresses e-mail publiques d'un domaine via Hunter.io
// (endpoint Domain Search). Complément de find-email.js, qui exige un nom
// de personne : ici on part du seul domaine, ce dont on dispose toujours
// quand on prospecte à partir d'un site.
//
// La fonction n'appelle qu'un seul service, api.hunter.io, sur une URL
// construite ici : le paramètre reçu est un nom de domaine, jamais une URL.
//
// Honnêteté : si la clé n'est pas configurée ou si Hunter ne renvoie rien,
// on le dit. Aucune adresse n'est devinée ni reconstituée côté serveur.
const { guard } = require("./_auth");

// Un nom de domaine, et rien d'autre : ni schéma, ni chemin, ni port.
const DOMAINE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

exports.handler = async function (event) {
  const denied = guard(event);
  if (denied) return denied;

  const p = event.queryStringParameters || {};
  const domaine = String(p.domain || "").trim().toLowerCase().replace(/^www\./, "");
  if (!domaine) return json(400, { error: "Paramètre `domain` manquant." });
  if (!DOMAINE.test(domaine) || domaine.length > 253) {
    return json(400, { error: "Ce n'est pas un nom de domaine." });
  }
  if (!process.env.HUNTER_API_KEY) {
    return json(501, { error: "HUNTER_API_KEY non configurée sur Netlify." });
  }

  const params = new URLSearchParams({
    domain: domaine,
    api_key: process.env.HUNTER_API_KEY,
    limit: "10",
  });
  // Un seul type d'adresse nous intéresse pour la prospection : les boîtes
  // génériques (contact@, info@…) sont publiées pour être écrites.
  if (p.type === "generic" || p.type === "personal") params.set("type", p.type);

  try {
    const r = await fetch("https://api.hunter.io/v2/domain-search?" + params.toString());
    const data = await r.json();
    if (!r.ok) {
      return json(r.status, { error: (data.errors && data.errors[0] && data.errors[0].details) || "Erreur API Hunter" });
    }
    const d = data.data || {};
    const emails = (d.emails || []).map((e) => ({
      email: e.value,
      type: e.type,
      confiance: e.confidence,
      prenom: e.first_name || "",
      nom: e.last_name || "",
      poste: e.position || "",
      verif: (e.verification && e.verification.status) || null,
    }));
    return json(200, {
      domaine,
      organisation: d.organisation || null,
      pattern: d.pattern || null,
      trouves: emails.length,
      emails,
      requetesRestantes: (data.meta && data.meta.results) != null ? undefined : undefined,
    });
  } catch (e) {
    return json(502, { error: e.message || "Hunter injoignable" });
  }
};
