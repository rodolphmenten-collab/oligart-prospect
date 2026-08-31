// Moteur de scoring carrière — 100% local, zéro appel API/IA. Score sur 100
// selon le barème exact demandé par Rodolph : titre (40), secteur (20),
// responsabilités (20), séniorité (10), localisation (10), + malus. Partagé
// entre le client (career.js) et les fonctions serveur (scan-career-free.js)
// pour ne jamais diverger. Format CommonJS + export global pour fonctionner
// aussi bien en <script> classique (navigateur) qu'en require() (Netlify Function).

const TITLE_SCORES = [
  [/general manager/i, 40, "General Manager"],
  [/managing director/i, 40, "Managing Director"],
  [/country manager/i, 40, "Country Manager"],
  [/directeur g[ée]n[ée]ral/i, 40, "Directeur Général"],
  [/country director/i, 38, "Country Director"],
  [/chief revenue officer|\bcro\b/i, 38, "Chief Revenue Officer"],
  [/chief commercial officer|\bcco\b/i, 38, "Chief Commercial Officer"],
  [/chief business officer|\bcbo\b/i, 38, "Chief Business Officer"],
  [/chief operating officer|\bcoo\b/i, 38, "Chief Operating Officer"],
  [/chief growth officer/i, 36, "Chief Growth Officer"],
  [/vp sales|vice president.*sales/i, 35, "VP Sales"],
  [/vp revenue|vice president.*revenue/i, 35, "VP Revenue"],
  [/international business director/i, 35, "International Business Director"],
  [/commercial director/i, 32, "Commercial Director"],
  [/directeur commercial/i, 32, "Directeur Commercial"],
  [/vp emea|vice president.*emea/i, 32, "VP EMEA"],
  [/head of partnerships|vp partnerships|vice president.*partnerships/i, 32, "VP/Head of Partnerships"],
  [/vp business development|director.*business development|directeur.*d[ée]veloppement commercial/i, 32, "VP/Director Business Development"],
  [/regional director/i, 30, "Regional Director"],
  [/head of revenue/i, 30, "Head of Revenue"],
  [/sales director/i, 28, "Sales Director"],
  [/managing partner/i, 28, "Managing Partner"],
  [/head of sales/i, 25, "Head of Sales"]
];

const SECTOR_SCORES = [
  [/adtech|ad-tech|advertising tech/i, 20, "AdTech"],
  [/martech|marketing tech/i, 20, "MarTech"],
  [/r[ée]gie (publicitaire|pub)\b|ad network|programmatic/i, 20, "Régie publicitaire / Programmatique"],
  [/\bmedia\b/i, 18, "Media"],
  [/advertising|publicit[ée]/i, 18, "Advertising"],
  [/\bsaas\b/i, 18, "SaaS"],
  [/marketplace/i, 15, "Marketplace"],
  [/\bdigital\b/i, 15, "Digital"],
  [/travel ?tech/i, 15, "Travel Tech"],
  [/retail ?tech/i, 12, "Retail Tech"],
  [/\bai\b|intelligence artificielle/i, 12, "AI"],
  [/\btech\b/i, 10, "Tech"]
];

const RESPONSIBILITY_KEYWORDS = [
  ["P&L", /\bp&l\b|profit and loss|compte de r[ée]sultat/i],
  ["France", /\bfrance\b/i],
  ["French market", /french market|march[ée] fran[çc]ais/i],
  ["go-to-market", /go-to-market|go to market/i],
  ["revenue", /\brevenue\b/i],
  ["sales leadership", /sales leadership|leadership commercial/i],
  ["team management", /team management|management d'[ée]quipe|gestion d'[ée]quipe/i],
  ["business development", /business development|d[ée]veloppement commercial/i],
  ["commercial strategy", /commercial strategy|strat[ée]gie commerciale/i],
  ["market launch", /market launch|lancement de march[ée]/i],
  ["international expansion", /international expansion|expansion internationale/i]
];
const RESPONSIBILITY_MAX = 20;
const RESPONSIBILITY_PER_MATCH = 4;

const SENIORITY_SCORES = [
  [/\bexecutive\b/i, 10, "Executive"],
  [/\bc-level\b|\bc level\b/i, 10, "C-level"],
  [/\bvp\b/i, 8, "VP"],
  [/\bdirector\b|\bdirecteur\b/i, 6, "Director"],
  [/\bgm\b/i, 8, "GM"]
];

const LOCATION_SCORES = [
  [/\bparis\b/i, 10, "Paris"],
  [/\bfrance\b/i, 10, "France"],
  [/remote france|t[ée]l[ée]travail france/i, 10, "Remote France"],
  [/europe/i, 8, "Europe (avec France dans le scope)"],
  [/london|londres/i, 5, "Londres (avec France dans le scope)"]
];

const MALUS = [
  [/\bjunior\b/i, -50, "Junior"],
  [/account executive/i, -40, "Account Executive"],
  [/\bsdr\b/i, -60, "SDR"],
  [/\bbdr\b/i, -60, "BDR"],
  [/\bstage\b|\binternship\b/i, -100, "Stage"],
  [/\balternance\b/i, -100, "Alternance"],
  [/sales manager(?!.*(director|country|international))/i, -20, "Sales Manager (sans responsabilité significative)"]
];

function scoreJob(job) {
  const title = job.title || "";
  const text = `${title} ${job.description || ""} ${job.location || ""}`;
  const reasons = [];
  let score = 0;

  // Titre — on prend le meilleur match, une seule fois (les titres sont mutuellement proches)
  let titleScore = 0;
  for (const [re, pts, label] of TITLE_SCORES) {
    if (re.test(title) && pts > titleScore) { titleScore = pts; }
  }
  if (titleScore > 0) {
    const matched = TITLE_SCORES.find(([re, pts]) => re.test(title) && pts === titleScore);
    reasons.push(matched[2]);
    score += titleScore;
  }

  // Secteur — meilleur match unique
  let sectorScore = 0, sectorLabel = null;
  for (const [re, pts, label] of SECTOR_SCORES) {
    if (re.test(text) && pts > sectorScore) { sectorScore = pts; sectorLabel = label; }
  }
  if (sectorScore > 0) { reasons.push(sectorLabel); score += sectorScore; }

  // Responsabilités — cumul plafonné
  let respPts = 0;
  for (const [label, re] of RESPONSIBILITY_KEYWORDS) {
    if (re.test(text)) { respPts += RESPONSIBILITY_PER_MATCH; reasons.push(label); }
  }
  respPts = Math.min(respPts, RESPONSIBILITY_MAX);
  score += respPts;

  // Séniorité — meilleur match unique
  let seniorityScore = 0;
  for (const [re, pts, label] of SENIORITY_SCORES) {
    if (re.test(text) && pts > seniorityScore) { seniorityScore = pts; }
  }
  score += seniorityScore;

  // Localisation — meilleur match unique
  let locScore = 0, locLabel = null;
  for (const [re, pts, label] of LOCATION_SCORES) {
    if (re.test(text) && pts > locScore) { locScore = pts; locLabel = label; }
  }
  if (locScore > 0) { reasons.push(locLabel); score += locScore; }

  // Malus — cumulatifs (plusieurs peuvent s'appliquer, ex: "Stage SDR")
  for (const [re, pts, label] of MALUS) {
    if (re.test(text)) { score += pts; reasons.push(`⚠ ${label}`); }
  }

  score = Math.max(0, Math.min(100, score));
  let tier = null;
  if (score >= 85) tier = "excellent";
  else if (score >= 70) tier = "good";
  else if (score >= 60) tier = "watch";

  return { score, reasons: [...new Set(reasons)], tier };
}

const CareerScoring = { scoreJob };
if (typeof module !== "undefined" && module.exports) module.exports = CareerScoring;
if (typeof window !== "undefined") window.CareerScoring = CareerScoring;
