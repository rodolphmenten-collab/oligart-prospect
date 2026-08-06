// Fonction planifiée (cron quotidien) : scanne un lot de ~5 entreprises par
// jour parmi les 200 (rotation complète en ~40 jours avec le lot par défaut,
// ajustable via RADAR_SCAN_BATCH_SIZE), cherche des signaux marché réels via
// l'API Anthropic + web_search, et les stocke dans Netlify Blobs — visibles
// par tous les appareils, pas seulement en local.
const { schedule } = require("@netlify/functions");
const { runRadarScan } = require("./_scan-lib");
const { scanStore } = require("./_store");
const companies = require("./_companies.json");

const handler = async () => {
  const result = await runRadarScan({
    store: scanStore(),
    fetchImpl: fetch,
    apiKey: process.env.ANTHROPIC_API_KEY,
    companies
  });
  // Les fonctions planifiées n'ont pas de "réponse" visible par un
  // utilisateur : le résultat est simplement journalisé pour debug dans les
  // logs Netlify. Toujours statusCode 200 pour que Netlify ne marque jamais
  // l'exécution comme échouée à cause d'une simple absence de résultat.
  console.log("[oligart] radar scan:", JSON.stringify(result));
  return { statusCode: 200, body: JSON.stringify(result) };
};

// Cron quotidien à 6h UTC. Format standard supporté par Netlify Scheduled Functions.
exports.handler = schedule("0 6 * * *", handler);
