// Trouve le décideur qui gère le budget media/pub (Directeur Marketing,
// Directeur Media, Head of Digital...). Deux étapes indépendantes, chacune
// pouvant réussir seule :
//
// 1. LINKEDIN (le plus important, "pas dur à trouver" même à la main) :
//    a. D'abord Hunter.io Domain Search (rapide, déjà indexé) si HUNTER_API_KEY
//       est configurée -- peut donner nom + poste + parfois LinkedIn direct.
//    b. Sinon, ou si Domain Search ne renvoie personne au bon poste, une
//       vraie recherche web via Tavily (tier gratuit permanent, inscriptions
//       ouvertes -- contrairement à Google Custom Search fermé aux nouveaux
//       comptes depuis 2026) directement sur linkedin.com pour "Entreprise +
//       Directeur Marketing/Media/Head of Digital...", dont on extrait le nom
//       et le poste depuis le titre du résultat LinkedIn.
// 2. EMAIL (bonus, jamais bloquant) : une fois un nom obtenu (peu importe la
//    source), Hunter Email Finder est tenté pour cette personne précise. Si
//    ça échoue ou si HUNTER_API_KEY est absente, le contact est quand même
//    renvoyé avec email vide -- avoir le nom + LinkedIn est déjà exploitable.
//
// Honnêteté : found:true dès qu'un nom + LinkedIn réels sont identifiés,
// même sans email. found:false uniquement si aucune des deux étapes n'a
// rien donné du tout. Jamais de nom ou de lien inventé.
const TARGET_ROLE_RE = /marketing|digital|m[ée]dia\b|media\b|communication|brand|acquisition|growth|publicit|advertis/i;
const EXCLUDE_ROLE_RE = /\bceo\b|chief executive|founder|fondateur|pr[ée]sident|head of sales|sales director|directeur commercial|vp sales|account executive/i;

async function hunterDomainSearch(company, domain) {
  if (!process.env.HUNTER_API_KEY) return [];
  const params = new URLSearchParams({ api_key: process.env.HUNTER_API_KEY, limit: "10" });
  if (domain) params.set("domain", domain); else params.set("company", company);
  try {
    const r = await fetch(`https://api.hunter.io/v2/domain-search?${params.toString()}`);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.data?.emails || [])
      .filter(e => e.position && TARGET_ROLE_RE.test(e.position) && !EXCLUDE_ROLE_RE.test(e.position))
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .map(e => ({ name: [e.first_name, e.last_name].filter(Boolean).join(" "), role: e.position || "", email: e.value, linkedin: e.linkedin || "" }));
  } catch { return []; }
}

// Recherche directe sur LinkedIn via Tavily -- exactement ce qu'on ferait à
// la main ("Hippopotamus directeur marketing" sur LinkedIn/Google). Le titre
// d'une page LinkedIn a le format "Prénom Nom - Poste - Entreprise | LinkedIn"
// ou "Prénom Nom | LinkedIn" : on extrait le nom (avant le premier " - " ou
// " | "), jamais inventé si le format ne matche pas un nom plausible.
function extractNameFromLinkedinTitle(title) {
  if (!title) return "";
  const head = title.split(/\s[-|–]\s/)[0].replace(/\s*\|\s*LinkedIn.*$/i, "").trim();
  const words = head.split(/\s+/);
  if (words.length < 2 || words.length > 4) return "";
  if (!words.every(w => /^[A-ZÀ-Ü][a-zà-ÿ'.-]+$/.test(w))) return "";
  return head;
}

// Recherche directe sur LinkedIn via Tavily -- exactement ce qu'on ferait à
// la main ("Hippopotamus directeur marketing" sur Google/LinkedIn). Tavily
// est un moteur en LANGAGE NATUREL, pas Google : il ne comprend pas "site:",
// les guillemets d'expression exacte ni "OR" comme opérateurs (vérifié --
// une première version utilisant cette syntaxe ne renvoyait rien, corrigé).
// La restriction de domaine passe uniquement par le paramètre include_domains.
async function linkedinSearchViaTavily(query) {
  if (!process.env.TAVILY_API_KEY) return [];
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify({ query, max_results: 8, include_domains: ["linkedin.com"], search_depth: "advanced" })
    });
    if (!r.ok) return [];
    const data = await r.json();
    const out = [];
    for (const hit of data.results || []) {
      if (!/linkedin\.com\/in\//.test(hit.url)) continue;
      const name = extractNameFromLinkedinTitle(hit.title);
      if (!name) continue; // titre pas au format attendu -- on n'invente pas un nom
      const roleMatch = (hit.title.match(/-\s*([^-|]+?)\s*-\s*[^-|]+\|/) || [])[1];
      out.push({ name, role: roleMatch || "", title: hit.title, content: hit.content || "", linkedin: hit.url });
    }
    return out;
  } catch { return []; }
}

// Exclusion géographique : un même nom d'entreprise ("Intersport") peut
// exister sans rapport dans plusieurs pays. Rejette tout résultat dont le
// titre/contenu mentionne clairement un pays/état étranger -- c'est ce qui
// a laissé passer "Craig Anderson, Marketing Director at Intersport,
// Cortland, Illinois" (une société américaine homonyme, rien à voir avec
// l'enseigne française). Approche par liste de blocage : imparfaite (ne
// couvre pas tous les pays possibles) mais élimine les cas les plus
// fréquents (résultats anglophones US/UK dominants sur LinkedIn).
const FOREIGN_LOCATION_RE = /\b(united states|usa|u\.s\.a?\.?|illinois|california|texas|new york|florida|united kingdom|england|scotland|london|germany|deutschland|canada|ontario|australia|india|nederland|netherlands)\b/i;

function isLikelyFrance(hit) {
  return !FOREIGN_LOCATION_RE.test(`${hit.title} ${hit.content}`);
}

async function hunterEmailFinder(fullName, company) {
  if (!process.env.HUNTER_API_KEY || !fullName) return "";
  try {
    const params = new URLSearchParams({ full_name: fullName, company, api_key: process.env.HUNTER_API_KEY });
    const r = await fetch(`https://api.hunter.io/v2/email-finder?${params.toString()}`);
    if (!r.ok) return "";
    const data = await r.json();
    return data.data?.email || "";
  } catch { return ""; }
}

// Désambiguïsation intelligente (optionnelle) : les filtres par mots-clés/
// listes de blocage (TARGET_ROLE_RE, isLikelyFrance) sont rigides et ratent
// des cas réels (Hippopotamus introuvable, homonyme américain d'Intersport
// mal filtré). Quand ANTHROPIC_API_KEY est configurée, les résultats bruts
// de la recherche LinkedIn sont soumis à un LLM qui raisonne vraiment :
// est-ce la bonne entreprise (pas un homonyme), la bonne personne, le bon
// poste -- au lieu d'un pattern-matching mécanique. Sans clé, ou si l'appel
// échoue, repli automatique sur le filtrage heuristique existant (jamais
// bloquant).
const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

async function aiPickCandidates(hits, company) {
  if (!process.env.ANTHROPIC_API_KEY || !hits.length) return null;
  try {
    const hitsText = hits.map((h, i) => `[${i}] Titre: "${h.title}"\nURL: ${h.linkedin}\nExtrait: "${(h.content || "").slice(0, 300)}"`).join("\n\n");
    const prompt = `Voici des résultats de recherche LinkedIn pour trouver le décideur qui gère le budget media/marketing/digital de l'entreprise française "${company}".\n\n${hitsText}\n\nAnalyse chaque résultat et identifie UNIQUEMENT les personnes qui :\n1. Travaillent réellement pour "${company}" en FRANCE (pas une entreprise homonyme dans un autre pays -- vérifie bien qu'il s'agit de la bonne entité)\n2. Ont un poste lié au marketing, à la communication, au digital ou aux médias (pas CEO, pas commercial/ventes, pas un métier sans rapport comme cuisinier ou RH)\n\nRéponds UNIQUEMENT en JSON valide, sans texte autour, format exact :\n{"candidates": [{"index": 0, "name": "Prénom Nom", "role": "intitulé du poste", "reasoning": "pourquoi cette personne correspond, en une phrase"}]}\n\nSi aucun résultat ne correspond clairement, réponds {"candidates": []}. Ne devine jamais -- si un doute sérieux existe sur l'entreprise ou le poste, exclus ce résultat.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 600, messages: [{ role: "user", content: prompt }] })
    });
    if (!r.ok) return null;
    const data = await r.json();
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.candidates)) return null;
    return parsed.candidates
      .filter(c => typeof c.index === "number" && hits[c.index])
      .map(c => ({ name: c.name || hits[c.index].name, role: c.role || hits[c.index].role, email: "", linkedin: hits[c.index].linkedin, aiReasoning: c.reasoning || "" }));
  } catch { return null; } // une IA indisponible ne doit jamais bloquer la recherche
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée" }) };
  }
  try {
    const { company, domain } = JSON.parse(event.body || "{}");
    if (!company && !domain) {
      return { statusCode: 400, body: JSON.stringify({ error: "Entreprise ou domaine requis" }) };
    }
    if (!process.env.HUNTER_API_KEY && !process.env.TAVILY_API_KEY) {
      return { statusCode: 501, body: JSON.stringify({ error: "Ni HUNTER_API_KEY ni TAVILY_API_KEY configurées sur Netlify" }) };
    }

    let candidates = await hunterDomainSearch(company, domain);
    let source = "hunter";
    if (!candidates.length) {
      // "France" explicitement dans la requête : sans ça, une entreprise au
      // nom homonyme à l'étranger (ex. un "Intersport" américain sans
      // rapport) peut ressortir en premier -- vu en conditions réelles.
      const hits = await linkedinSearchViaTavily(`${company || domain} France directeur marketing responsable marketing head of digital directeur communication`);

      // Priorité à la désambiguïsation IA (raisonne vraiment sur chaque
      // résultat) ; repli sur le filtrage par mots-clés/liste de blocage
      // si pas de clé Anthropic ou si l'appel échoue.
      const aiPicked = await aiPickCandidates(hits, company || domain);
      if (aiPicked && aiPicked.length) {
        candidates = aiPicked;
        source = "linkedin_search_ai";
      } else {
        candidates = hits
          .filter(h => TARGET_ROLE_RE.test(h.title) && isLikelyFrance(h))
          .map(h => ({ name: h.name, role: h.role, email: "", linkedin: h.linkedin }));
        source = "linkedin_search";
      }
    }

    if (!candidates.length) {
      return { statusCode: 200, body: JSON.stringify({ found: false, reason: "Aucun contact marketing/digital/media trouvé, ni via Hunter ni via recherche LinkedIn directe" }) };
    }

    async function finalize(c) {
      let linkedin = c.linkedin;
      // Si Hunter a donné un nom sans LinkedIn, on tente Tavily pour le
      // compléter -- même garde-fou anti-homonyme (nom de famille requis
      // dans l'URL/titre) que pour l'email finder.
      if (!linkedin && process.env.TAVILY_API_KEY && c.name) {
        const hits = await linkedinSearchViaTavily(`${c.name} ${company || domain} LinkedIn`).catch(() => []);
        const lastName = c.name.trim().split(/\s+/).pop()?.toLowerCase() || "";
        const match = hits.find(h => h.linkedin.toLowerCase().includes(lastName));
        if (match) linkedin = match.linkedin;
      }
      let email = c.email;
      if (!email) email = await hunterEmailFinder(c.name, company || domain);
      return { name: c.name, role: c.role, email, linkedin, source };
    }

    const contact1 = await finalize(candidates[0]);
    const contact2 = candidates[1] ? await finalize(candidates[1]) : null;

    return { statusCode: 200, body: JSON.stringify({ found: true, contact1, contact2 }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Erreur serveur" }) };
  }
};
