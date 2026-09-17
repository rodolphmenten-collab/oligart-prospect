// Garde d'accès partagée par toutes les fonctions sensibles.
//
// Pourquoi : ces fonctions étaient publiques. N'importe qui connaissant
// l'URL du site pouvait lire la boîte mail (fetch-inbox) ou envoyer un
// email depuis l'adresse Oligart (send-email), sans aucune authentification.
//
// Principe : un jeton partagé, stocké côté Netlify dans la variable
// d'environnement APP_TOKEN, que le front envoie dans l'en-tête
// "x-oligart-token". Le jeton n'est PAS écrit dans le code JavaScript
// public -- il est saisi une fois par Rodolph dans le navigateur et
// conservé en localStorage. Un visiteur sans le jeton reçoit 401.
//
// Choix volontaire : si APP_TOKEN n'est pas configurée, on FERME l'accès
// (503) au lieu de laisser passer. Une garde qui s'ouvre toute seule quand
// la configuration manque ne protège rien.
const crypto = require("crypto");

function equals(a, b) {
  const ba = Buffer.from(String(a), "utf8");
  const bb = Buffer.from(String(b), "utf8");
  // timingSafeEqual exige des longueurs identiques : on compare d'abord la
  // longueur (information non secrète), puis le contenu en temps constant.
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function deny(statusCode, error) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error })
  };
}

// Renvoie null si l'appel est autorisé, sinon la réponse d'erreur à
// retourner telle quelle par la fonction appelante.
exports.guard = function guard(event) {
  const expected = process.env.APP_TOKEN;
  if (!expected) {
    return deny(503, "APP_TOKEN n'est pas configurée sur Netlify : accès fermé par sécurité.");
  }
  const headers = event && event.headers ? event.headers : {};
  // Netlify normalise les en-têtes en minuscules, mais on reste tolérant.
  const provided = headers["x-oligart-token"] || headers["X-Oligart-Token"] || "";
  if (!provided) return deny(401, "Jeton d'accès manquant.");
  if (!equals(provided, expected)) return deny(401, "Jeton d'accès invalide.");
  return null;
};

// En-tête à propager lors d'un appel interne (fonction de déclenchement
// vers sa fonction d'arrière-plan), pour que la garde reste active des deux
// côtés sans avoir à rouvrir la fonction d'arrière-plan au public.
exports.forwardHeader = function forwardHeader(event) {
  const headers = event && event.headers ? event.headers : {};
  const token = headers["x-oligart-token"] || headers["X-Oligart-Token"] || "";
  return token ? { "x-oligart-token": token } : {};
};
