// Lecture seule : renvoie les suggestions d'offres d'emploi détectées
// automatiquement (VP Sales, GM, Country Manager, CRO, Head of Sales),
// stockées centralement. C'est au client (career.js) de proposer d'accepter
// ou d'ignorer chaque suggestion — rien n'est ajouté au pipeline personnel
// sans action explicite de Rodolph.
const { scanStore } = require("./_store");

exports.handler = async () => {
  const store = scanStore();
  const suggestions = (await store.get("career-suggestions")) || [];
  const lastRun = (await store.get("career-last-run")) || null;
  return { statusCode: 200, body: JSON.stringify({ suggestions, lastRun }) };
};
