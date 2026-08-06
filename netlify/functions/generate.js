// Fonction Netlify : génère du texte (email, DM LinkedIn, pitch, préparation RDV,
// compte rendu) via l'API Anthropic. Nécessite la variable d'environnement
// ANTHROPIC_API_KEY côté Netlify. Si elle est absente ou si l'appel échoue,
// retourne une erreur claire — le client (ai.js) bascule alors sur un modèle
// de texte local, l'app reste donc toujours utilisable sans clé configurée.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const PROMPTS = {
  email: (p) =>
    `Rédige un email de prospection court (120 mots max), en français, professionnel mais chaleureux, ` +
    `signé par Rodolph Menten (Oligart, conseil en go-to-market / structuration commerciale). ` +
    `Destinataire : ${p.targetRole || "décideur"} de ${p.company} (secteur : ${p.sector || "n/c"}). ` +
    `Contexte : ${p.why || "aucun contexte spécifique fourni"}. ` +
    `Notes internes : ${p.notes || "aucune"}. ` +
    `Pas d'objet, juste le corps de l'email.`,
  linkedin_dm: (p) =>
    `Rédige un message LinkedIn court (500 caractères max), en français, direct et personnalisé, ` +
    `pour approcher ${p.ceoName || p.targetRole || "le décideur"} de ${p.company}. ` +
    `Contexte : ${p.why || "aucun contexte spécifique"}. Signé Rodolph Menten (Oligart).`,
  pitch: (p) =>
    `Rédige un pitch oral de 3 phrases (pour un appel de 20 minutes), en français, expliquant ` +
    `pourquoi Oligart (conseil go-to-market / structuration commerciale / partenariats / media buying) ` +
    `peut aider ${p.company} (secteur ${p.sector || "n/c"}). Contexte : ${p.why || "aucun"}.`,
  meeting_prep: (p) =>
    `Prépare une fiche de préparation de rendez-vous (en français, format à puces courtes) pour un ` +
    `échange avec ${p.company} (secteur ${p.sector || "n/c"}, CEO : ${p.ceoName || "inconnu"}, ` +
    `Head of Sales : ${p.headOfSalesName || "inconnu"}). Inclure : 3 questions à poser, 3 points de valeur ` +
    `Oligart à mettre en avant, 1 objection probable et comment y répondre. Contexte : ${p.why || "aucun"}. Notes : ${p.notes || "aucune"}.`,
  meeting_recap: (p) =>
    `Transforme ces notes brutes de rendez-vous en compte rendu structuré (français, format à puces : ` +
    `Contexte, Points clés, Décisions, Prochaines étapes avec échéances). Notes brutes :\n${p.rawNotes || ""}`
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée" }) };
  }
  try {
    const body = JSON.parse(event.body || "{}");
    const { kind, prospect } = body;
    if (!kind || !PROMPTS[kind]) {
      return { statusCode: 400, body: JSON.stringify({ error: "Type de génération invalide" }) };
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return { statusCode: 501, body: JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée sur Netlify" }) };
    }
    const prompt = PROMPTS[kind]({ ...(prospect || {}), rawNotes: body.rawNotes });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      return { statusCode: r.status, body: JSON.stringify({ error: data.error?.message || "Erreur API Anthropic" }) };
    }
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    return { statusCode: 200, body: JSON.stringify({ text }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Erreur serveur" }) };
  }
};
