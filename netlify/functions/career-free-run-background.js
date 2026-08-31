// Fonction d'arrière-plan (le suffixe -background la fait reconnaître comme
// telle par Netlify : jusqu'à 15 minutes d'exécution au lieu des 10 secondes
// d'une fonction synchrone classique). Le scan carrière gratuit interroge
// maintenant 6 sources (Greenhouse/Lever sur ~53 entreprises, France
// Travail, LinkedIn x2 méthodes, WTTJ, APEC), largement au-dessus de ce que
// permet une fonction synchrone -- d'où le "Scan indisponible (code 504)"
// observé en conditions réelles. Même pattern déjà en place pour l'ancien
// scan IA (scan-trigger.js / scan-run-background.js).
const { runFreeCareerScan } = require("./_career-free.js");
const { scanStore } = require("./_store.js");
const companies = require("../../career-companies.json");

exports.handler = async () => {
  const store = scanStore();
  await store.set("career-free-scan-status", { state: "running", startedAt: Date.now() });
  try {
    const result = await runFreeCareerScan({ store, fetchImpl: fetch, companies });
    await store.set("career-free-scan-status", { state: "done", finishedAt: Date.now(), result });
  } catch (e) {
    await store.set("career-free-scan-status", { state: "done", finishedAt: Date.now(), error: e.message || "Erreur inconnue" });
  }
  return { statusCode: 200, body: "ok" };
};
