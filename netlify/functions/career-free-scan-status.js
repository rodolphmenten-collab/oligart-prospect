// Lecture seule : renvoie l'état du dernier scan carrière gratuit déclenché
// manuellement (running/done), pour que le client puisse afficher une
// progression réelle par sondage périodique plutôt que d'attendre une
// réponse synchrone qui dépasserait la limite de 10s de Netlify.
const { scanStore } = require("./_store.js");

exports.handler = async () => {
  const store = scanStore();
  const status = (await store.get("career-free-scan-status")) || { state: "idle" };
  return { statusCode: 200, body: JSON.stringify(status) };
};
