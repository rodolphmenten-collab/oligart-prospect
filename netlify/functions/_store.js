// Adaptateur au-dessus de Netlify Blobs, avec la même interface get/set
// minimaliste attendue par _scan-lib.js. Centralise la gestion d'erreurs :
// si Blobs n'est pas disponible (site pas encore déployé sur Netlify,
// contexte local sans configuration), get() renvoie simplement undefined
// et set() échoue silencieusement plutôt que de faire planter l'appelant.
// Toute erreur rencontrée est quand même journalisée (console.warn) pour
// rester diagnosticable depuis les logs de fonctions Netlify.
const { getStore } = require("@netlify/blobs");

// getStore() peut lever une exception SYNCHRONE si le contexte Netlify Blobs
// n'est pas configuré (ex. exécution locale, tests). On la neutralise ici :
// mieux vaut un store qui répond "vide" plutôt qu'une fonction qui plante.
function safeGetStore() {
  try { return getStore("oligart-scan"); }
  catch (e) { console.warn("[oligart] getStore() failed:", e.message); return null; }
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
