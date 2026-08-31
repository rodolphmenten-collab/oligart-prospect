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
// Deux modes de recherche selon la typologie du prospect :
// - "annonceur" (défaut) : cherche le décideur marketing/media/digital
//   (celui qui gère le budget pub), exclut CEO/Sales explicitement.
// - "agence" (agences media indépendantes) : cherche le CEO/fondateur, le
//   Head of Digital, OU le Head of Sales/Directeur Commercial -- ces
//   agences (souvent en région, hors Paris) ont typiquement besoin de
//   profils commerciaux, et c'est exactement l'angle du pitch freelance
//   de Rodolph (business dev / management commercial).
const ROLE_TARGETS = {
  annonceur: {
    target: /marketing|digital|m[ée]dia\b|media\b|communication|brand|acquisition|growth|publicit|advertis/i,
    exclude: /\bceo\b|chief executive|founder|fondateur|pr[ée]sident|head of sales|sales director|directeur commercial|vp sales|account executive|corporate communications?|communication corporate|public relations|relations publiques|relations presse|corporate affairs|\bpr\b/i,
    // Plusieurs requêtes distinctes plutôt qu'une seule mêlant tous les
    // termes -- une requête combinée dilue le classement de pertinence et
    // ne ramenait souvent qu'1 ou 2 résultats exploitables au total (vu en
    // conditions réelles sur Jacadi). Chaque requête est lancée en
    // parallèle et les résultats fusionnés/dédoublonnés.
    queries: ["directeur marketing", "responsable marketing", "head of digital", "directeur communication"]
  },
  agence: {
    target: /\bceo\b|chief executive|founder|fondateur|pr[ée]sident|directeur g[ée]n[ée]ral|head of digital|dirigeant|g[ée]rant|head of sales|sales director|directeur commercial|vp sales/i,
    exclude: /account executive|directeur marketing|responsable marketing|chief marketing|community manager|charg[ée] de communication/i,
    queries: ["CEO fondateur", "directeur général dirigeant", "head of digital", "head of sales directeur commercial"]
  }
};

function targetsFor(mode) { return ROLE_TARGETS[mode] || ROLE_TARGETS.annonceur; }

async function hunterDomainSearch(company, domain, mode) {
  if (!process.env.HUNTER_API_KEY) return [];
  const { target, exclude } = targetsFor(mode);
  const params = new URLSearchParams({ api_key: process.env.HUNTER_API_KEY, limit: "10" });
  if (domain) params.set("domain", domain); else params.set("company", company);
  try {
    const r = await fetch(`https://api.hunter.io/v2/domain-search?${params.toString()}`);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.data?.emails || [])
      .filter(e => e.position && target.test(e.position) && !exclude.test(e.position))
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
  // Le nom de famille est parfois écrit tout en majuscules sur LinkedIn
  // (convention française courante, ex. "Vincent HOUDOU") -- la regex
  // n'acceptait avant que la casse "Titre" (Prénom Nom), ce qui rejetait
  // silencieusement ces profils comme "pas un nom plausible". Accepte
  // maintenant aussi la casse tout-majuscule par mot.
  if (!words.every(w => /^[A-ZÀ-Ü][a-zà-ÿ'.-]+$/.test(w) || /^[A-ZÀ-Ü'-]{2,}$/.test(w))) return "";
  // Reformate en Prénom Nom propre même si le nom était en majuscules.
  return words.map(w => /^[A-ZÀ-Ü'-]{2,}$/.test(w) && w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w).join(" ");
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
      body: JSON.stringify({ query, max_results: 10, include_domains: ["linkedin.com"], search_depth: "advanced" })
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

// Lance toutes les requêtes du mode en parallèle et fusionne/dédoublonne
// par URL LinkedIn -- ratisse beaucoup plus large qu'une seule requête
// combinée, qui ne ramenait souvent qu'un ou deux résultats exploitables
// au total en conditions réelles.
async function multiQuerySearch(mode, company, domain) {
  const { queries } = targetsFor(mode);
  const target = company || domain;
  const results = await Promise.all(queries.map(q => linkedinSearchViaTavily(`${target} France ${q}`)));
  const seen = new Map();
  for (const hits of results) {
    for (const h of hits) {
      if (!seen.has(h.linkedin)) seen.set(h.linkedin, h);
    }
  }
  return [...seen.values()];
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

async function aiPickCandidates(hits, company, mode) {
  if (!process.env.ANTHROPIC_API_KEY || !hits.length) return null;
  try {
    const hitsText = hits.map((h, i) => `[${i}] Titre: "${h.title}"\nURL: ${h.linkedin}\nExtrait: "${(h.content || "").slice(0, 500)}"`).join("\n\n");
    const roleInstruction = mode === "agence"
      ? 'Ont un poste de CEO, fondateur, président, directeur général, Head of Digital, Head of Sales ou Directeur Commercial (PAS un poste marketing/communication classique, PAS community manager)'
      : 'Ont un poste lié à l\'achat/gestion du budget media, au marketing digital, ou aux médias (PAS CEO, PAS commercial/ventes, PAS un poste de communication corporate/institutionnelle/relations publiques/relations presse -- ces postes gèrent l\'image et la presse, pas le budget media, et ne conviennent pas ; PAS un métier sans rapport comme cuisinier ou RH)';
    const targetDescription = mode === "agence"
      ? "trouver le CEO/fondateur, le Head of Digital ou le responsable commercial (Head of Sales/Directeur Commercial) de l'agence media indépendante française"
      : "trouver le décideur qui gère le budget media/marketing/digital de l'entreprise française";
    const prompt = `Voici des résultats de recherche LinkedIn pour ${targetDescription} "${company}".\n\n${hitsText}\n\nAnalyse chaque résultat et identifie les personnes qui :\n1. Travaillent (ou ont un lien clair, même passé/multi-casquettes) avec "${company}" en FRANCE (pas une entreprise homonyme dans un autre pays)\n2. ${roleInstruction}\n\nObjectif : proposer à l'utilisateur JUSQU'À 6 candidats PLAUSIBLES parmi lesquels choisir lui-même -- pas seulement le meilleur. Inclus un candidat même en cas de doute modéré (indique-le dans "confidence"), n'exclus que les cas clairement hors sujet (mauvais pays, poste sans rapport, mauvaise entreprise). Mieux vaut proposer un candidat incertain que de n'en proposer aucun.\n\nRéponds UNIQUEMENT en JSON valide, sans texte autour, format exact :\n{"candidates": [{"index": 0, "name": "Prénom Nom", "role": "intitulé du poste", "confidence": "élevée|moyenne|faible", "reasoning": "pourquoi cette personne pourrait correspondre, en une phrase"}]}\n\nSi vraiment aucun résultat n'a de lien plausible avec l'entreprise, réponds {"candidates": []}.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 1200, messages: [{ role: "user", content: prompt }] })
    });
    if (!r.ok) return null;
    const data = await r.json();
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.candidates)) return null;
    // Confiance élevée d'abord, pour que le Contact 1 initial soit le
    // meilleur pari plutôt qu'un ordre arbitraire.
    const confidenceRank = { "élevée": 0, "moyenne": 1, "faible": 2 };
    return parsed.candidates
      .filter(c => typeof c.index === "number" && hits[c.index])
      .sort((a, b) => (confidenceRank[a.confidence] ?? 1) - (confidenceRank[b.confidence] ?? 1))
      .map(c => ({ name: c.name || hits[c.index].name, role: c.role || hits[c.index].role, email: "", linkedin: hits[c.index].linkedin, aiReasoning: c.reasoning || "", confidence: c.confidence || "" }));
  } catch { return null; } // une IA indisponible ne doit jamais bloquer la recherche
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée" }) };
  }
  try {
    const { company, domain, category } = JSON.parse(event.body || "{}");
    if (!company && !domain) {
      return { statusCode: 400, body: JSON.stringify({ error: "Entreprise ou domaine requis" }) };
    }
    if (!process.env.HUNTER_API_KEY && !process.env.TAVILY_API_KEY) {
      return { statusCode: 501, body: JSON.stringify({ error: "Ni HUNTER_API_KEY ni TAVILY_API_KEY configurées sur Netlify" }) };
    }
    const AGENCY_CATEGORIES = ["Agences Média Indépendantes"];
    const mode = AGENCY_CATEGORIES.includes(category) ? "agence" : "annonceur";
    const { target, exclude } = targetsFor(mode);

    let candidates = await hunterDomainSearch(company, domain, mode);
    let source = "hunter";
    if (!candidates.length) {
      // Plusieurs requêtes en parallèle (une par terme de poste), fusionnées
      // et dédoublonnées -- une seule requête combinée ne ramenait souvent
      // qu'1-2 résultats exploitables au total (vu en conditions réelles sur
      // Jacadi : "Candidat 1/1", rien d'autre à proposer).
      const hits = await multiQuerySearch(mode, company, domain);

      // Vérification explicite que le nom de l'entreprise apparaît dans le
      // contenu réel du profil (titre OU extrait de bio) -- absente avant
      // ce correctif. Sans ça, un profil au titre LinkedIn axé sur une AUTRE
      // société (cas réel : un dirigeant multi-casquettes dont le titre
      // affiché est "Fondateur - Société A" alors qu'il est aussi
      // co-fondateur de la société recherchée, mentionné seulement dans sa
      // bio complète) pouvait être retenu ou rejeté au hasard, sans lien
      // avec la vraie pertinence.
      const companyWords=(company||domain||'').toLowerCase().split(/\s+/).filter(w=>w.length>2);
      const mentionsCompany=h=>{
       const text=`${h.title} ${h.content}`.toLowerCase();
       return companyWords.some(w=>text.includes(w));
      };

      // Priorité à la désambiguïsation IA (raisonne vraiment sur chaque
      // résultat, y compris le contenu complet de la bio -- pas seulement
      // le titre, et propose jusqu'à 6 candidats plausibles plutôt qu'un
      // seul "meilleur" choix) ; repli sur le filtrage par mots-clés/liste
      // de blocage si pas de clé Anthropic ou si l'appel échoue.
      const aiPicked = await aiPickCandidates(hits, company || domain, mode);
      if (aiPicked && aiPicked.length) {
        candidates = aiPicked;
        source = "linkedin_search_ai";
      } else {
        candidates = hits
          // Le "titre" indexé par un moteur de recherche peut être différent
          // (parfois périmé) de la bio réelle affichée dans le contenu --
          // vérifié en conditions réelles : le rôle extrait du titre ne
          // mentionnait pas "fondateur" alors que le contenu, lui, disait
          // clairement "Dirigeant & Fondateur". On teste donc la pertinence
          // du poste sur le rôle ET sur le contenu, pas seulement le rôle.
          .filter(h => {
            const roleText = `${h.role || ""} ${h.content || ""}`;
            return target.test(roleText) && !exclude.test(roleText) && isLikelyFrance(h) && mentionsCompany(h);
          })
          .map(h => ({ name: h.name, role: h.role || "(poste précis non confirmé, voir profil)", email: "", linkedin: h.linkedin }));
        source = "linkedin_search";
      }
    }

    if (!candidates.length) {
      const label = mode === "agence" ? "CEO/fondateur/Head of Digital" : "marketing/digital/media";
      return { statusCode: 200, body: JSON.stringify({ found: false, reason: `Aucun contact ${label} trouvé, ni via Hunter ni via recherche LinkedIn directe` }) };
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

    // Jusqu'à 5 candidats renvoyés (pas seulement le meilleur) : le client
    // peut ainsi proposer un autre contact à chaque nouveau clic sur
    // "Trouver le contact" sans refaire d'appel serveur, jusqu'à ce que
    // Rodolph trouve la bonne personne -- un Directeur Communication
    // Corporate par exemple ne l'intéresse pas même si le poste matche
    // vaguement "communication", il veut pouvoir passer au suivant.
    // Seul le premier candidat est "finalisé" (email cherché via Hunter
    // Email Finder + LinkedIn complété via Tavily si besoin) pour ne pas
    // multiplier les appels API à chaque recherche -- les suivants gardent
    // les infos déjà obtenues par la recherche initiale (nom/poste/parfois
    // LinkedIn/parfois email si Hunter Domain Search les avait déjà).
    const candidatesList = candidates.slice(0, 6);
    const contact1 = await finalize(candidatesList[0]);
    const contact2 = candidatesList[1] ? await finalize(candidatesList[1]) : null;
    const restFinalized = candidatesList.slice(2).map(c => ({ name: c.name, role: c.role, email: c.email || "", linkedin: c.linkedin || "", source }));

    return { statusCode: 200, body: JSON.stringify({ found: true, contact1, contact2, candidates: [contact1, contact2, ...restFinalized].filter(Boolean) }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Erreur serveur" }) };
  }
};
