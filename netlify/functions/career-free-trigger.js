// Déclenchement manuel du scan carrière gratuit (bouton "Actualiser les
// offres" dans l'app). Contrairement au scan IA (payant), celui-ci n'a pas
// de limite de fréquence stricte -- Greenhouse/Lever sont des APIs
// publiques gratuites sans quota connu -- mais on garde un léger
// anti-abus (1x/2 min) pour rester raisonnable.
const { runFreeCareerScan } = require("./_career-free.js");
const { scanStore } = require("./_store.js");
const companies = require("../../career-companies.json");

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
  const result = await runFreeCareerScan({ store, fetchImpl: fetch, companies });
  return { statusCode: 200, body: JSON.stringify(result) };
};
