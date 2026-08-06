// Déclenchement manuel des deux scans (bouton "Lancer un scan maintenant"
// dans Paramètres). Protégé par une limite simple : pas plus d'un
// déclenchement manuel toutes les 10 minutes, pour éviter qu'un clic répété
// ne fasse gonfler la facture API. Les scans planifiés quotidiens ne sont
// pas concernés par cette limite (ils tournent une fois par jour de toute
// façon).
const { runRadarScan, runCareerScan } = require("./_scan-lib");
const { scanStore } = require("./_store");
const companies = require("./_companies.json");

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

  const deps = { store, fetchImpl: fetch, apiKey: process.env.ANTHROPIC_API_KEY };
  const [radar, career] = await Promise.all([
    runRadarScan({ ...deps, companies }),
    runCareerScan(deps)
  ]);
  return { statusCode: 200, body: JSON.stringify({ radar, career }) };
};
