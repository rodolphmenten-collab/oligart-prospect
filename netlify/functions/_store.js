// Adaptateur au-dessus de Netlify Blobs, avec la même interface get/set
// minimaliste attendue par _scan-lib.js. Centralise la gestion d'erreurs :
// si Blobs n'est pas disponible (site pas encore déployé sur Netlify,
// contexte local sans configuration), get() renvoie simplement undefined
// et set() échoue silencieusement plutôt que de faire planter l'appelant.
// Toute erreur rencontrée est quand même journalisée (console.warn) pour
// rester diagnosticable depuis les logs de fonctions Netlify.
//
// Contournement d'un problème connu côté Netlify : l'injection automatique
// du contexte Blobs (siteID/token) échoue parfois en production même avec
// un usage par ailleurs correct (getStore() appelé dans le handler, pas au
// chargement du module) — voir https://github.com/netlify/blobs/issues/175
// et plusieurs signalements similaires sur le forum Netlify. On tente
// d'abord l'injection automatique ; si elle échoue, on retombe sur une
// configuration explicite via BLOBS_SITE_ID/BLOBS_TOKEN (variables
// d'environnement à renseigner manuellement sur Netlify).
const { getStore } = require("@netlify/blobs");

function safeGetStore() {
  try { return getStore("oligart-scan"); }
  catch (e) {
    console.warn("[oligart] getStore() auto failed:", e.message);
    if (process.env.BLOBS_SITE_ID && process.env.BLOBS_TOKEN) {
      try {
        return getStore({ name: "oligart-scan", siteID: process.env.BLOBS_SITE_ID, token: process.env.BLOBS_TOKEN });
      } catch (e2) {
        console.warn("[oligart] getStore() explicite (BLOBS_SITE_ID/BLOBS_TOKEN) a aussi échoué:", e2.message);
        return null;
      }
    }
    console.warn("[oligart] BLOBS_SITE_ID/BLOBS_TOKEN non configurés — impossible de contourner l'échec de l'injection automatique.");
    return null;
  }
}

function scanStore() {
  return {
    async get(key) {
      const store = safeGetStore();
      if (!store) return undefined;
      try {
        const value = await store.get(key, { type: "json" });
        console.log(`[oligart] blobs get("${key}") ->`, value === null ? "null (clé absente)" : (Array.isArray(value) ? `array(${value.length})` : typeof value));
        return value;
      } catch (e) { console.warn(`[oligart] blobs get("${key}") failed:`, e.message); return undefined; }
    },
    async set(key, value) {
      const store = safeGetStore();
      if (!store) return false;
      try {
        await store.setJSON(key, value);
        console.log(`[oligart] blobs set("${key}") OK, ${Array.isArray(value) ? value.length + ' éléments' : typeof value}`);
        return true;
      } catch (e) { console.warn(`[oligart] blobs set("${key}") failed:`, e.message); return false; }
    }
  };
}

module.exports = { scanStore };
