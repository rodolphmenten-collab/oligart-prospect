// Connecteurs carrière 100% gratuits, sans clé API, sans IA. Greenhouse et
// Lever exposent tous deux une API JSON publique officielle par entreprise
// (pas de scraping HTML fragile). Un slug invalide renvoie simplement une
// liste vide ou une erreur HTTP -- jamais un plantage, jamais une offre
// inventée. Chaque entreprise est interrogée indépendamment
// (Promise.allSettled) : une source qui échoue n'empêche jamais les autres
// de remonter des résultats.
const { scoreJob } = require("../../career-scoring.js");

const TARGET_TITLE_RE = /general manager|managing director|country manager|country director|chief revenue officer|\bcro\b|chief commercial officer|\bcco\b|vp sales|vp revenue|international business director|commercial director|directeur commercial|regional director|sales director|managing partner|head of sales|directeur g[ée]n[ée]ral/i;

function normalize(str) {
  return String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function fingerprint(job) {
  return `${normalize(job.company)}|${normalize(job.title)}|${normalize(job.location)}`;
}

async function fetchGreenhouse(companyMeta, fetchImpl) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${companyMeta.slug}/jobs?content=true`;
  const r = await fetchImpl(url);
  if (!r.ok) throw new Error(`Greenhouse ${companyMeta.slug}: HTTP ${r.status}`);
  const data = await r.json();
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  return jobs
    .filter(j => TARGET_TITLE_RE.test(j.title || ""))
    .map(j => ({
      id: `greenhouse-${companyMeta.slug}-${j.id}`,
      title: j.title,
      company: companyMeta.company,
      location: j.location?.name || "",
      description: (j.content || "").replace(/<[^>]+>/g, " ").slice(0, 2000),
      salary: "",
      publishedAt: j.updated_at || j.created_at || "",
      discoveredAt: new Date().toISOString(),
      source: "Greenhouse",
      sourceUrl: j.absolute_url || url,
      applyUrl: j.absolute_url || url,
      remote: /remote|t[ée]l[ée]travail/i.test(j.location?.name || ""),
      ats: "greenhouse"
    }));
}

async function fetchLever(companyMeta, fetchImpl) {
  const url = `https://api.lever.co/v0/postings/${companyMeta.slug}?mode=json`;
  const r = await fetchImpl(url);
  if (!r.ok) throw new Error(`Lever ${companyMeta.slug}: HTTP ${r.status}`);
  const jobs = await r.json();
  if (!Array.isArray(jobs)) return [];
  return jobs
    .filter(j => TARGET_TITLE_RE.test(j.text || ""))
    .map(j => ({
      id: `lever-${companyMeta.slug}-${j.id}`,
      title: j.text,
      company: companyMeta.company,
      location: j.categories?.location || "",
      description: (j.descriptionPlain || "").slice(0, 2000),
      salary: j.salaryRange ? `${j.salaryRange.min || ""}-${j.salaryRange.max || ""} ${j.salaryRange.currency || ""}`.trim() : "",
      publishedAt: j.createdAt ? new Date(j.createdAt).toISOString() : "",
      discoveredAt: new Date().toISOString(),
      source: "Lever",
      sourceUrl: j.hostedUrl || url,
      applyUrl: j.applyUrl || j.hostedUrl || url,
      remote: /remote|t[ée]l[ée]travail/i.test(j.categories?.location || ""),
      ats: "lever"
    }));
}

/**
 * Scanne toutes les entreprises de la liste (Greenhouse + Lever), score chaque
 * offre localement (career-scoring.js, zéro IA), déduplique par empreinte,
 * fusionne avec le stockage existant. Renvoie aussi le statut par source
 * (succès/échec) pour affichage transparent côté UI.
 */
async function runFreeCareerScan(deps) {
  const { store, fetchImpl, companies } = deps;
  const { fetchFranceTravail } = require("./_career-francetravail.js");
  const { fetchLinkedIn } = require("./_career-linkedin.js");
  const { fetchWTTJ } = require("./_career-wttj.js");

  const results = await Promise.allSettled(
    companies.map(c => (c.ats === "lever" ? fetchLever(c, fetchImpl) : fetchGreenhouse(c, fetchImpl)))
  );

  const sitesOk = [], sitesFailed = [];
  const allJobs = [];
  results.forEach((res, i) => {
    const c = companies[i];
    if (res.status === "fulfilled") {
      sitesOk.push(c.company);
      allJobs.push(...res.value);
    } else {
      sitesFailed.push({ company: c.company, reason: res.reason?.message || "erreur inconnue" });
    }
  });

  // France Travail, LinkedIn et WTTJ sont des sources transversales (pas par
  // entreprise) -- statut ajouté séparément, jamais bloquant pour le reste.
  const [ftResult, liResult, wttjResult] = await Promise.allSettled([
    fetchFranceTravail(fetchImpl),
    fetchLinkedIn(fetchImpl),
    fetchWTTJ(fetchImpl)
  ]);

  if (ftResult.status === "fulfilled") {
    if (ftResult.value.skipped) sitesFailed.push({ company: "France Travail", reason: "FRANCETRAVAIL_CLIENT_ID/SECRET non configurées" });
    else { sitesOk.push("France Travail"); allJobs.push(...ftResult.value.jobs); }
  } else {
    sitesFailed.push({ company: "France Travail", reason: ftResult.reason?.message || "erreur inconnue" });
  }

  if (liResult.status === "fulfilled") {
    if (liResult.value.blocked) sitesFailed.push({ company: "LinkedIn", reason: "Endpoint invité indisponible ou bloqué (limite anti-scraping) -- normal, non bloquant" });
    else { sitesOk.push("LinkedIn"); allJobs.push(...liResult.value.jobs); }
  } else {
    sitesFailed.push({ company: "LinkedIn", reason: liResult.reason?.message || "erreur inconnue" });
  }

  if (wttjResult.status === "fulfilled") {
    if (wttjResult.value.blocked) sitesFailed.push({ company: "Welcome to the Jungle", reason: "Indisponible (clé Algolia probablement changée depuis) -- non bloquant" });
    else { sitesOk.push("Welcome to the Jungle"); allJobs.push(...wttjResult.value.jobs); }
  } else {
    sitesFailed.push({ company: "Welcome to the Jungle", reason: wttjResult.reason?.message || "erreur inconnue" });
  }

  const existing = (await store.get("career-jobs-free")) || [];
  const existingByFp = new Map(existing.map(j => [fingerprint(j), j]));
  const today = new Date().toISOString().slice(0, 10);
  let added = 0, updated = 0;

  for (const job of allJobs) {
    const scored = scoreJob(job);
    const fp = fingerprint(job);
    const record = { ...job, fingerprint: fp, score: scored.score, scoreReasons: scored.reasons, tier: scored.tier, status: "new", lastSeenAt: today };
    const prev = existingByFp.get(fp);
    if (prev) {
      // Offre déjà connue : on rafraîchit les données factuelles mais on
      // préserve le statut choisi par l'utilisateur (candidaté, entretien...).
      record.status = prev.status || "new";
      record.savedNote = prev.savedNote;
      updated++;
    } else {
      added++;
    }
    existingByFp.set(fp, record);
  }

  const merged = [...existingByFp.values()].sort((a, b) => (b.score || 0) - (a.score || 0));
  await store.set("career-jobs-free", merged);
  await store.set("career-jobs-free-last-run", today);
  return { skipped: false, added, updated, total: merged.length, sitesOk, sitesFailed };
}

module.exports = { runFreeCareerScan, fingerprint, TARGET_TITLE_RE };
