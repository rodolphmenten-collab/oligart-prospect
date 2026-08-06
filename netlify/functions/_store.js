// Adaptateur au-dessus de Netlify Blobs, avec la même interface get/set
// minimaliste attendue par _scan-lib.js. Centralise la gestion d'erreurs :
// si Blobs n'est pas disponible (site pas encore déployé sur Netlify,
// contexte local sans configuration), get() renvoie simplement undefined
// et set() échoue silencieusement plutôt que de faire planter l'appelant.
const { getStore } = require("@netlify/blobs");

// getStore() peut lever une exception SYNCHRONE si le contexte Netlify Blobs
// n'est pas configuré (ex. exécution locale, tests). On la neutralise ici :
// mieux vaut un store qui répond "vide" plutôt qu'une fonction qui plante.
function safeGetStore() {
  try { return getStore("oligart-scan"); }
  catch { return null; }
}

function scanStore() {
  return {
    async get(key) {
      const store = safeGetStore();
      if (!store) return undefined;
      try { return await store.get(key, { type: "json" }); }
      catch { return undefined; }
    },
    async set(key, value) {
      const store = safeGetStore();
      if (!store) return false;
      try { await store.setJSON(key, value); return true; }
      catch { return false; }
    }
  };
}

module.exports = { scanStore };
