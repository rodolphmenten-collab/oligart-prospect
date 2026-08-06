// Fonction planifiée (cron quotidien) : cherche de nouvelles offres pour les
// rôles cibles de Rodolph (VP Sales, GM, Country Manager, CRO, Head of
// Sales) via l'API Anthropic + web_search, et stocke les suggestions dans
// Netlify Blobs. Rien n'est ajouté automatiquement au pipeline personnel de
// Rodolph : les suggestions sont proposées côté client (career.js), avec un
// choix explicite "Ajouter" ou "Ignorer".
const { schedule } = require("@netlify/functions");
const { runCareerScan } = require("./_scan-lib");
const { scanStore } = require("./_store");

const handler = async () => {
  const result = await runCareerScan({
    store: scanStore(),
    fetchImpl: fetch,
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  console.log("[oligart] career scan:", JSON.stringify(result));
  return { statusCode: 200, body: JSON.stringify(result) };
};

// Cron quotidien à 6h10 UTC (décalé du scan radar pour ne pas cumuler les
// deux appels au même instant).
exports.handler = schedule("10 6 * * *", handler);
