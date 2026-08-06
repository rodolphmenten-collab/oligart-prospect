// Fonction Netlify : indique si les variables d'environnement nécessaires (SMTP,
// clé IA) sont configurées, SANS JAMAIS renvoyer leur valeur. Utilisée par la
// page Paramètres pour afficher un statut "Configuré / Non configuré".
exports.handler = async () => {
  const smtp = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_HOST);
  const ai = Boolean(process.env.ANTHROPIC_API_KEY);
  return { statusCode: 200, body: JSON.stringify({ smtp, ai }) };
};
