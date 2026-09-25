// Stockage serveur de la base prospects (Netlify Blobs).
//
// Pourquoi : jusqu'ici la base vivait uniquement dans le localStorage du
// navigateur. Chaque navigateur avait donc sa propre copie, et personne ne
// voyait le travail de l'autre. La campagne "Offre Refonte" repose sur un
// aller-retour (l'agent prépare, Rodolph valide et envoie) : sans base
// partagée, ce workflow ne peut pas fonctionner.
//
// Le blob est un JSON { rev, updatedAt, prospects }. `rev` sert à détecter
// les écrasements concurrents : un PUT qui ne porte pas la révision courante
// est refusé (409) plutôt que d'écraser silencieusement.
//
// Même contournement que _store.js pour l'injection de contexte Blobs, qui
// échoue parfois en production (voir le commentaire détaillé dans ce fichier).
const { getStore } = require("@netlify/blobs");
const { guard } = require("./_auth");

const STORE = "oligart-crm";
const KEY = "prospects";
const EMPTY = { rev: 0, updatedAt: null, prospects: null };

function safeGetStore() {
  try { return getStore(STORE); }
  catch (e) {
    console.warn("[oligart] crm-data getStore() auto failed:", e.message);
    const siteID = process.env.SITE_ID;
    const token = process.env.BLOBS_TOKEN;
    if (siteID && token) {
      try { return getStore({ name: STORE, siteID, token }); }
      catch (e2) { console.warn("[oligart] crm-data getStore() explicite a aussi échoué:", e2.message); return null; }
    }
    console.warn("[oligart] crm-data : BLOBS_TOKEN non configuré.");
    return null;
  }
}

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) };
}

exports.handler = async function (event) {
  const denied = guard(event);
  if (denied) return denied;

  const store = safeGetStore();
  if (!store) {
    // On le dit franchement : le client repassera en mode local plutôt que
    // de croire à une base vide.
    return json(503, { error: "Stockage serveur indisponible (Blobs non configuré)." });
  }

  if (event.httpMethod === "GET") {
    try {
      const raw = await store.get(KEY, { type: "json" });
      return json(200, raw || EMPTY);
    } catch (e) {
      console.warn("[oligart] crm-data lecture échouée:", e.message);
      return json(503, { error: "Lecture impossible : " + e.message });
    }
  }

  if (event.httpMethod === "PUT" || event.httpMethod === "POST") {
    let payload;
    try { payload = JSON.parse(event.body || "{}"); }
    catch { return json(400, { error: "Corps de requête illisible." }); }
    if (!Array.isArray(payload.prospects)) {
      return json(400, { error: "Champ `prospects` manquant ou invalide." });
    }
    // Garde-fou : on refuse d'écraser une base fournie par une base vide,
    // sauf demande explicite. Une erreur côté client ne doit jamais pouvoir
    // effacer des centaines de fiches.
    let current = EMPTY;
    try { current = (await store.get(KEY, { type: "json" })) || EMPTY; } catch { /* première écriture */ }
    const avant = Array.isArray(current.prospects) ? current.prospects.length : 0;
    if (!payload.force && avant > 10 && payload.prospects.length < avant / 2) {
      return json(409, {
        error: `Écriture refusée : la base passerait de ${avant} à ${payload.prospects.length} fiches.`,
        serverRev: current.rev,
      });
    }

    const clientRev = Number(payload.rev);
    if (!payload.force && Number.isFinite(clientRev) && clientRev !== current.rev) {
      return json(409, { error: "Données modifiées ailleurs entre-temps.", serverRev: current.rev, clientRev });
    }

    const next = { rev: (current.rev || 0) + 1, updatedAt: new Date().toISOString(), prospects: payload.prospects };
    try { await store.setJSON(KEY, next); }
    catch (e) {
      console.warn("[oligart] crm-data écriture échouée:", e.message);
      return json(503, { error: "Écriture impossible : " + e.message });
    }
    return json(200, { rev: next.rev, updatedAt: next.updatedAt, count: next.prospects.length });
  }

  return json(405, { error: "Méthode non supportée." });
};
