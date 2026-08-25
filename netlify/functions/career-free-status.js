// Met à jour le statut (Sauvegardé / À candidater / Candidature envoyée /
// Entretien / Refusé / Archivé) d'une offre détectée par le scan gratuit,
// pour que ce choix survive aux rescans suivants (identifié par empreinte
// company+titre+lieu, pas par un ID de base de données).
const { scanStore } = require("./_store.js");

const VALID_STATUSES = ["new", "saved", "to_apply", "applied", "interview", "rejected", "archived"];

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée" }) };
  }
  try {
    const { fingerprint, status } = JSON.parse(event.body || "{}");
    if (!fingerprint || !VALID_STATUSES.includes(status)) {
      return { statusCode: 400, body: JSON.stringify({ error: "fingerprint et status valide requis" }) };
    }
    const store = scanStore();
    const jobs = (await store.get("career-jobs-free")) || [];
    const job = jobs.find(j => j.fingerprint === fingerprint);
    if (!job) {
      return { statusCode: 404, body: JSON.stringify({ error: "Offre introuvable" }) };
    }
    job.status = status;
    await store.set("career-jobs-free", jobs);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Erreur serveur" }) };
  }
};
