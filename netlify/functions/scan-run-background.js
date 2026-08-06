// Fonction d'arrière-plan (le suffixe -background la fait reconnaître comme
// telle par Netlify : jusqu'à 15 minutes d'exécution, au lieu des 10 secondes
// d'une fonction synchrone classique). C'est ici que le travail réel des
// scans a lieu quand ils sont déclenchés manuellement. Netlify répond 202 à
// l'appelant (scan-trigger.js) dès l'invocation, sans attendre la fin —
// scan-trigger.js reste donc rapide même si le scan complet prend 20 à 60
// secondes (recherche web incluse).
const { runRadarScan, runCareerScan } = require("./_scan-lib");
const { scanStore } = require("./_store");
const companies = require("./_companies.json");

exports.handler = async () => {
  const store = scanStore();
  await store.set("manual-scan-status", { state: "running", startedAt: Date.now() });
  const deps = { store, fetchImpl: fetch, apiKey: process.env.ANTHROPIC_API_KEY };
  const [radar, career] = await Promise.all([
    runRadarScan({ ...deps, companies }),
    runCareerScan(deps)
  ]);
  await store.set("manual-scan-status", { state: "done", finishedAt: Date.now(), radar, career });
  console.log("[oligart] manual scan finished:", JSON.stringify({ radar, career }));
  return { statusCode: 200, body: JSON.stringify({ radar, career }) };
};
