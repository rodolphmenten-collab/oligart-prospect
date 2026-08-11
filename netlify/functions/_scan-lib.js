// Librairie partagée par les fonctions de scan planifiées et le déclenchement
// manuel. Séparée dans un module à part (plutôt que dupliquée dans chaque
// fonction) pour pouvoir être testée avec des dépendances simulées (store en
// mémoire, fetch simulé) sans dépendre de l'environnement réel Netlify Blobs.
//
// Principe : on utilise l'API Anthropic avec l'outil web_search côté serveur
// pour aller chercher des informations réelles et récentes (levées de fonds,
// recrutements, changements de direction, offres d'emploi). Aucune donnée
// n'est inventée : si la recherche ne trouve rien de pertinent, rien n'est
// ajouté — mieux vaut une liste courte et fiable qu'une liste remplie de
// suppositions.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const RADAR_BATCH_SIZE = Number(process.env.RADAR_SCAN_BATCH_SIZE || 5);

function hashId(str) {
  // Petit hash déterministe (pas cryptographique) pour dédoublonner des
  // entrées sans dépendance externe.
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
  return "h" + Math.abs(h).toString(36);
}

async function callClaudeWithSearch(apiKey, prompt, fetchImpl) {
  const r = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || "Erreur API Anthropic");
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
  return text;
}

function extractJsonArray(text) {
  // Le modèle peut entourer le JSON de texte ou de balises markdown : on
  // extrait le premier tableau JSON valide trouvé, sans planter sinon.
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Scan Radar Marché : interroge un lot d'entreprises, retourne les signaux
 * trouvés, dédoublonne contre l'existant, fait tourner le pointeur de lot.
 * @param {object} deps - { store, fetchImpl, apiKey, companies }
 *   store: { get(key), set(key, value) } — abstraction au-dessus de Netlify Blobs
 */
async function runRadarScan(deps) {
  const { store, fetchImpl, apiKey, companies } = deps;
  if (!apiKey) return { skipped: true, reason: "ANTHROPIC_API_KEY non configurée" };
  if (!companies || !companies.length) return { skipped: true, reason: "Aucune entreprise à scanner" };

  const cursor = (await store.get("radar-cursor")) || 0;
  const batch = [];
  for (let i = 0; i < RADAR_BATCH_SIZE; i++) {
    batch.push(companies[(cursor + i) % companies.length]);
  }
  const nextCursor = (cursor + RADAR_BATCH_SIZE) % companies.length;

  const list = batch.map(c => `- ${c.company} (${c.sector || "secteur inconnu"}, ${c.country || "pays inconnu"})`).join("\n");
  const prompt = `Recherche sur le web des actualités RÉCENTES (moins de 30 jours si possible) concernant ces entreprises :\n${list}\n\n` +
    `Pour chacune, cherche uniquement : levée de fonds, recrutement significatif (croissance d'équipe), ouverture dans un nouveau pays, ` +
    `changement de CEO, changement de CRO/Head of Sales. Si tu ne trouves rien de fiable et récent pour une entreprise, ne l'inclus pas.\n\n` +
    `Réponds UNIQUEMENT avec un tableau JSON (aucun texte autour, aucun markdown), chaque élément au format :\n` +
    `{"company":"nom exact tel que fourni","type":"funding|hiring|expansion|ceo_change|cro_change","note":"résumé en une phrase, en français","source":"URL de la source"}`;

  let signals = [];
  try {
    const text = await callClaudeWithSearch(apiKey, prompt, fetchImpl);
    signals = extractJsonArray(text);
  } catch (e) {
    return { skipped: true, reason: e.message };
  }

  const existing = (await store.get("radar-signals")) || [];
  const existingIds = new Set(existing.map(s => s.id));
  const companyById = Object.fromEntries(batch.map(c => [c.company, c]));
  const today = new Date().toISOString().slice(0, 10);
  let added = 0;
  for (const s of signals) {
    if (!s || typeof s !== "object" || !s.company || !s.type || !s.note) continue;
    const match = companyById[s.company];
    if (!match) continue; // on ignore toute entreprise hors du lot demandé (anti-hallucination)
    const id = hashId(`${s.company}|${s.type}|${s.note}`.slice(0, 200));
    if (existingIds.has(id)) continue;
    existing.unshift({ id, prospectId: match.id, company: s.company, type: s.type, note: String(s.note).slice(0, 300), source: s.source || "", date: today });
    existingIds.add(id);
    added++;
  }
  const capped = existing.slice(0, 300);
  await store.set("radar-signals", capped);
  await store.set("radar-cursor", nextCursor);
  await store.set("radar-last-run", today);
  return { skipped: false, scanned: batch.map(c => c.company), added, total: capped.length };
}

/**
 * Scan Opportunités Carrière : cherche des offres correspondant aux rôles
 * cibles, ajoute des suggestions (jamais directement dans le pipeline de
 * l'utilisateur — c'est lui qui accepte ou ignore côté client).
 */
async function runCareerScan(deps) {
  const { store, fetchImpl, apiKey } = deps;
  if (!apiKey) return { skipped: true, reason: "ANTHROPIC_API_KEY non configurée" };

  const roles = "VP of Sales, Head of Sales, Country Manager, General Manager, CRO";
  const sites = "LinkedIn (linkedin.com/jobs), APEC (apec.fr), Cadremploi (cadremploi.fr), Welcome to the Jungle (welcometothejungle.com), Indeed (indeed.fr)";
  const industries = "digital, publicité/adtech, tech, médias";
  const prompt = `Recherche sur le web des offres d'emploi RÉCENTES (moins de 14 jours si possible) en France pour les postes suivants : ${roles}. ` +
    `Cherche spécifiquement sur ces sites : ${sites}. ` +
    `Secteurs cibles : ${industries} (startups, scale-ups, groupes établis — pas de limite de taille d'entreprise). ` +
    `Pour chaque offre trouvée, l'URL doit pointer directement vers l'annonce (pas vers une page de recherche générique). ` +
    `Si tu ne trouves rien de fiable et récent, réponds avec un tableau vide.\n\n` +
    `Réponds UNIQUEMENT avec un tableau JSON (aucun texte autour, aucun markdown), maximum 15 éléments, chaque élément au format :\n` +
    `{"role":"intitulé du poste tel qu'annoncé","company":"nom de l'entreprise","link":"URL directe de l'offre (obligatoire, jamais vide)","source":"nom du site (LinkedIn, APEC, Cadremploi, Welcome to the Jungle, Indeed...)","note":"résumé en une phrase"}`;

  let suggestions = [];
  try {
    const text = await callClaudeWithSearch(apiKey, prompt, fetchImpl);
    suggestions = extractJsonArray(text);
  } catch (e) {
    return { skipped: true, reason: e.message };
  }

  const existing = (await store.get("career-suggestions")) || [];
  const existingIds = new Set(existing.map(s => s.id));
  const today = new Date().toISOString().slice(0, 10);
  let added = 0;
  for (const s of suggestions) {
    if (!s || typeof s !== "object" || !s.company || !s.role) continue;
    // Une suggestion sans lien direct vers l'offre est inutile pour Rodolph
    // (le but est de pouvoir cliquer et postuler) — on l'ignore.
    if (!s.link || typeof s.link !== "string" || !/^https?:\/\//i.test(s.link)) continue;
    const id = hashId(`${s.company}|${s.role}|${s.link}`.slice(0, 200));
    if (existingIds.has(id)) continue;
    existing.unshift({ id, role: String(s.role).slice(0, 120), company: String(s.company).slice(0, 120), link: s.link, source: s.source || "", note: (s.note || "").slice(0, 300), date: today });
    existingIds.add(id);
    added++;
  }
  const capped = existing.slice(0, 120);
  await store.set("career-suggestions", capped);
  await store.set("career-last-run", today);
  return { skipped: false, added, total: capped.length };
}

module.exports = { runRadarScan, runCareerScan, hashId, extractJsonArray };
