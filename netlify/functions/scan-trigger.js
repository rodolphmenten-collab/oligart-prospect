// Déclenchement manuel des scans (bouton "Lancer un scan maintenant" dans
// Paramètres). Cette fonction reste synchrone et légère à dessein : elle
// vérifie la limite anti-abus (1 déclenchement / 10 min), puis invoque la
// vraie fonction d'arrière-plan (scan-run-background) qui fait le travail
// long. Netlify répond 202 à cet appel interne immédiatement, donc
// scan-trigger.js répond vite au client sans jamais atteindre la limite de
// 10 secondes des fonctions synchrones classiques.
const { scanStore } = require("./_store");

const COOLDOWN_MS = 10 * 60 * 1000;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée" }) };
  }
  const store = scanStore();
  const lastTrigger = await store.get("manual-trigger-last");
  const now = Date.now();
  if (lastTrigger && now - lastTrigger < COOLDOWN_MS) {
    const waitSec = Math.ceil((COOLDOWN_MS - (now - lastTrigger)) / 1000);
    return { statusCode: 429, body: JSON.stringify({ error: `Un scan a déjà été lancé récemment. Réessaie dans ${waitSec}s.` }) };
  }
  await store.set("manual-trigger-last", now);
  await store.set("manual-scan-status", { state: "running", startedAt: now });

  try {
    const host = event.headers?.host;
    if (!host) throw new Error("Host introuvable dans la requête");
    // Fire-and-forget côté logique métier : Netlify répond 202 à cet appel
    // dès l'invocation de la fonction d'arrière-plan, sans attendre sa fin.
    await fetch(`https://${host}/.netlify/functions/scan-run-background`, { method: "POST" });
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Impossible de lancer le scan : " + e.message }) };
  }
  return { statusCode: 202, body: JSON.stringify({ started: true }) };
};
