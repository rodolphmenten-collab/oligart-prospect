// Lecture seule : renvoie les signaux marché détectés automatiquement,
// stockés centralement (Netlify Blobs), visibles depuis n'importe quel
// appareil. Si le store est vide ou indisponible, renvoie une liste vide
// plutôt qu'une erreur — le client affiche alors son état vide habituel.
const { scanStore } = require("./_store");

exports.handler = async () => {
  const store = scanStore();
  const signals = (await store.get("radar-signals")) || [];
  const lastRun = (await store.get("radar-last-run")) || null;
  return { statusCode: 200, body: JSON.stringify({ signals, lastRun }) };
};
