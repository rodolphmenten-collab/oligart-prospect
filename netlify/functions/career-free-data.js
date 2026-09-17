// Lecture seule des offres carrière trouvées gratuitement (Greenhouse +
// Lever), déjà scorées et dédupliquées. Toujours 200 avec une liste vide
// plutôt qu'une erreur si le store est vide ou indisponible.
const { scanStore } = require("./_store.js");

const { guard: __guard } = require("./_auth");
exports.handler = async (event) => {
  const __denied = __guard(event);
  if (__denied) return __denied;
  const store = scanStore();
  const jobs = (await store.get("career-jobs-free")) || [];
  const lastRun = (await store.get("career-jobs-free-last-run")) || null;
  return { statusCode: 200, body: JSON.stringify({ jobs, lastRun }) };
};
