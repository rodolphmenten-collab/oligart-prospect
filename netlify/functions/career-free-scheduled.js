// Fonction planifiée : scan carrière gratuit (Greenhouse + Lever) deux fois
// par jour, 07:00 et 17:00 UTC. Aucun coût API (sources publiques
// gratuites), donc contrairement aux anciens scans IA, l'automatisation ne
// pose pas de problème de consommation de crédits -- elle peut tourner
// sans intervention de Rodolph.
const { schedule } = require("@netlify/functions");
const { runFreeCareerScan } = require("./_career-free.js");
const { scanStore } = require("./_store.js");
const companies = require("../../career-companies.json");

const handler = async () => {
  const result = await runFreeCareerScan({ store: scanStore(), fetchImpl: fetch, companies });
  console.log("[oligart] free career scan:", JSON.stringify(result));
  return { statusCode: 200, body: JSON.stringify(result) };
};

exports.handler = schedule("0 7,17 * * *", handler);
