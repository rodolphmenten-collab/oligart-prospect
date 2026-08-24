// Fonction Netlify : génère du texte (email, DM LinkedIn, pitch, préparation RDV,
// compte rendu) via l'API Anthropic. Nécessite la variable d'environnement
// ANTHROPIC_API_KEY côté Netlify. Si elle est absente ou si l'appel échoue,
// retourne une erreur claire — le client (ai.js) bascule alors sur un modèle
// de texte local, l'app reste donc toujours utilisable sans clé configurée.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// Positionnement Oligart, repris dans tous les prompts pour rester cohérent :
// stratégie d'achat media 360° (branding + performance), inventaire premium
// brand-safe, KPIs garantis, en direct avec des honoraires transparents.
const OLIGART_PITCH = "Oligart accompagne les annonceurs à la fois en conseil (structuration de la stratégie média et go-to-market, priorisation des leviers) et en exécution opérationnelle sur l'achat media 360° — branding (display, vidéo, audio, CTV, DOOH) et performance (native, retargeting) sur un seul dispositif. Différenciants à l'exécution : inventaire 100% premium et brand-safe (vérifié par des tiers indépendants type DoubleVerify/IAS), KPIs garantis sur chaque format (CPC, CPM, reach, taux de complétion vidéo — pas de best-effort), ciblage data précis (400+ segments, sans cookies tiers, conforme RGPD). Le tout géré en direct, avec des honoraires transparents et un format plus flexible qu'une agence traditionnelle.";

const PROMPTS = {
  email: (p) =>
    `Rédige un email de prospection court (120-150 mots max), en français, professionnel mais chaleureux, ` +
    `signé par Rodolph Menten. Positionnement à intégrer naturellement (ne pas tout citer mot pour mot, choisir 2-3 points les plus pertinents pour ce destinataire) : ${OLIGART_PITCH} ` +
    `Destinataire : ${p.targetRole || "décideur"} de ${p.company} (secteur : ${p.sector || "n/c"}). ` +
    `Contexte : ${p.why || "aucun contexte spécifique fourni"}. ` +
    `Notes internes : ${p.notes || "aucune"}. ` +
    `Pas d'objet, juste le corps de l'email.`,
  linkedin_dm: (p) =>
    `Rédige un message LinkedIn court (500 caractères max), en français, direct et personnalisé, ` +
    `pour approcher ${p.ceoName || p.targetRole || "le décideur"} de ${p.company} au sujet de sa stratégie média digitale. ` +
    `Contexte : ${p.why || "aucun contexte spécifique"}. Positionnement (choisir 1-2 points marquants, pas tout) : ${OLIGART_PITCH} Signé Rodolph Menten.`,
  pitch: (p) =>
    `Rédige un pitch oral de 3 phrases (pour un appel de 20 minutes), en français, expliquant ` +
    `pourquoi Oligart peut aider ${p.company} (secteur ${p.sector || "n/c"}). Positionnement : ${OLIGART_PITCH} ` +
    `Contexte : ${p.why || "aucun"}.`,
  meeting_prep: (p) =>
    `Prépare une fiche de préparation de rendez-vous (en français, format à puces courtes) pour un ` +
    `échange avec ${p.company} (secteur ${p.sector || "n/c"}, CEO : ${p.ceoName || "inconnu"}, ` +
    `Head of Sales : ${p.headOfSalesName || "inconnu"}). Inclure : 3 questions à poser sur leur stratégie média actuelle, 3 points de valeur ` +
    `Oligart à mettre en avant (piocher dans : ${OLIGART_PITCH}), 1 objection probable et comment y répondre. Contexte : ${p.why || "aucun"}. Notes : ${p.notes || "aucune"}.`,
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
