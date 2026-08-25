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
const ROLE_QUERY_TERMS = '("Directeur Marketing" OR "Directeur Media" OR "Directeur de la Communication" OR "Head of Digital" OR "Head of Marketing" OR "Responsable Communication" OR "Responsable Marketing" OR "Chief Marketing Officer")';

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

async function linkedinSearchViaTavily(company) {
  if (!process.env.TAVILY_API_KEY) return [];
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify({ query: `site:linkedin.com/in "${company}" ${ROLE_QUERY_TERMS}`, max_results: 5, include_domains: ["linkedin.com"] })
    });
    if (!r.ok) return [];
    const data = await r.json();
    const out = [];
    for (const hit of data.results || []) {
      if (!/linkedin\.com\/in\//.test(hit.url)) continue;
      const name = extractNameFromLinkedinTitle(hit.title);
      if (!name) continue; // titre pas au format attendu -- on n'invente pas un nom
      const roleMatch = (hit.title.match(/-\s*([^-|]+?)\s*-\s*[^-|]+\|/) || [])[1];
      out.push({ name, role: roleMatch || "", email: "", linkedin: hit.url });
    }
    return out;
  } catch { return []; }
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
      const hits = await linkedinSearchViaTavily(company || domain);
      // Filtre de pertinence : le titre du résultat LinkedIn doit contenir
      // un terme de poste marketing/digital/media pour être retenu comme
      // candidat -- sinon on ne sait pas si cette personne a un rapport
      // avec le poste recherché, même si son nom est bien formé.
      candidates = hits.filter(h => h.role && TARGET_ROLE_RE.test(h.role));
      source = "linkedin_search";
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
        const hits = await linkedinSearchViaTavily(`${c.name} ${company || domain}`).catch(() => []);
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
