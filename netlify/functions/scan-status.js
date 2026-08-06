// Lecture seule : renvoie l'état du dernier scan manuel déclenché
// (running/done), pour que le client puisse afficher une progression réelle
// plutôt qu'un simple message "lancé" sans confirmation.
const { scanStore } = require("./_store");

exports.handler = async () => {
  const store = scanStore();
  const status = (await store.get("manual-scan-status")) || { state: "idle" };
  return { statusCode: 200, body: JSON.stringify(status) };
};
