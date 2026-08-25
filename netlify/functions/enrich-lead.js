// Enrichissement gratuit d'une fiche, sans API payante, sans IA. Utilise
// l'API officielle "Recherche d'Entreprises" (recherche-entreprises.api.gouv.fr),
// gratuite, sans clé, alimentée par l'INSEE (Sirene) et le RNE. Donne des
// données réelles et vérifiées : effectif (tranche), secteur (NAF), siège
// social, dirigeants légalement déclarés.
//
// Honnêteté : si l'entreprise n'est pas trouvée (nom ambigu, réseau de
// franchise sans entité légale correspondant exactement au nom commercial,
// entreprise étrangère hors périmètre Sirene...), on renvoie clairement
// found:false -- jamais une donnée devinée à la place. Les dirigeants
// renvoyés sont ceux déclarés légalement (RNE), qui peuvent différer du
// contact commercial/marketing réel : présentés comme "suggestion à
// vérifier", jamais injectés automatiquement à la place d'un contact déjà
// renseigné à la main.
const EFFECTIF_LABELS = {
  "00": "0 salarié", "01": "1-2 salariés", "02": "3-5 salariés", "03": "6-9 salariés",
  "11": "10-19 salariés", "12": "20-49 salariés", "21": "50-99 salariés",
  "22": "100-199 salariés", "31": "200-249 salariés", "32": "250-499 salariés",
  "41": "500-999 salariés", "42": "1000-1999 salariés", "51": "2000-4999 salariés",
  "52": "5000-9999 salariés", "53": "10000+ salariés"
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée" }) };
  }
  try {
    const { company } = JSON.parse(event.body || "{}");
    if (!company) return { statusCode: 400, body: JSON.stringify({ error: "Nom d'entreprise requis" }) };

    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(company)}&per_page=1`;
    const r = await fetch(url);
    if (!r.ok) return { statusCode: 200, body: JSON.stringify({ found: false, reason: `API indisponible (HTTP ${r.status})` }) };
    const data = await r.json();
    const result = (data.results || [])[0];
    if (!result) return { statusCode: 200, body: JSON.stringify({ found: false, reason: "Aucune entreprise correspondante trouvée dans le registre officiel" }) };

    const effectifCode = result.tranche_effectif_salarie;
    const dirigeants = (result.dirigeants || [])
      .filter(d => d.nom || d.denomination)
      .slice(0, 3)
      .map(d => ({
        nom: d.denomination || [d.prenoms, d.nom].filter(Boolean).join(" "),
        qualite: d.qualite || ""
      }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        found: true,
        siren: result.siren,
        nomOfficiel: result.nom_complet || result.nom_raison_sociale,
        effectif: effectifCode ? (EFFECTIF_LABELS[effectifCode] || `tranche ${effectifCode}`) : "",
        secteur: result.activite_principale || "",
        siege: result.siege ? [result.siege.ville, result.siege.code_postal].filter(Boolean).join(" ") : "",
        dateCreation: result.date_creation || "",
        dirigeants
      })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Erreur serveur" }) };
  }
};
