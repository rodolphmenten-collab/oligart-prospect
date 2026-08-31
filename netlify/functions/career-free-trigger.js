// Déclenchement manuel du scan carrière gratuit (bouton "Actualiser les
// offres" dans l'app). Reste synchrone et léger à dessein : vérifie la
// limite anti-abus (1x/2 min), puis invoque la vraie fonction d'arrière-plan
// (career-free-run-background) qui fait le travail long. Netlify répond
// 202 à cet appel interne immédiatement, donc career-free-trigger.js
// répond vite au client sans jamais atteindre la limite de 10 secondes des
// fonctions synchrones classiques -- ce qui causait le "Scan indisponible
// (code 504)" observé en conditions réelles depuis l'ajout de plusieurs
// nouvelles sources (APEC, LinkedIn via Tavily, WTTJ...).
const { scanStore } = require("./_store.js");

const COOLDOWN_MS = 2 * 60 * 1000;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée" }) };
  }
  const store = scanStore();
  const last = await store.get("career-jobs-free-trigger-last");
  const now = Date.now();
  if (last && now - last < COOLDOWN_MS) {
    const waitSec = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
    return { statusCode: 429, body: JSON.stringify({ error: `Scan déjà lancé récemment. Réessaie dans ${waitSec}s.` }) };
  }
  await store.set("career-jobs-free-trigger-last", now);
  await store.set("career-free-scan-status", { state: "running", startedAt: now });

  try {
    const host = event.headers?.host;
    if (!host) throw new Error("Host introuvable dans la requête");
    // Fire-and-forget : on n'attend pas la fin de l'exécution de la fonction
    // d'arrière-plan, seulement la confirmation qu'elle a bien démarré.
    await fetch(`https://${host}/.netlify/functions/career-free-run-background`, { method: "POST" });
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Impossible de lancer le scan : " + e.message }) };
  }
  return { statusCode: 202, body: JSON.stringify({ started: true }) };
};
