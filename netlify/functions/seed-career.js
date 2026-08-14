// Insertion ponctuelle de suggestions carrière trouvées manuellement (via
// recherche web dans une conversation avec Claude, sans passer par le scan
// automatique payant). Écrit directement dans le même stockage centralisé
// (career-suggestions) que scan-run-background.js — les entrées ajoutées
// ici apparaissent normalement dans le panneau "Suggestions détectées
// automatiquement" d'Opportunités Carrière, avec le choix habituel
// "Ajouter" / "Ignorer". Gratuit : aucun appel à l'API Anthropic.
//
// Déclenchement : simple visite de l'URL (GET), pas de token ni de
// configuration nécessaire. Le contenu est codé en dur ci-dessous ; pour
// ajouter un nouveau lot plus tard, il suffit de modifier ce tableau et
// redéployer.
const { hashId } = require("./_scan-lib");
const { scanStore } = require("./_store");

const MANUAL_FINDS = [
  { role: "Country Manager, France (programmatic advertising)", company: "PubMatic", link: "https://fr.linkedin.com/jobs/view/country-manager-france-programmatic-advertising-at-pubmatic-3467841268", source: "LinkedIn", note: "Adtech pur, membre de l'équipe Go-To-Market France." },
  { role: "Head of Sales (VC backed company)", company: "XAnge (portefeuille)", link: "https://www.welcometothejungle.com/fr/companies/xange/jobs/application-sales-vp-head-of-sales-xange-hyper-growing-scale-ups_paris", source: "Welcome to the Jungle", note: "Poste chez une participation en forte croissance du fonds XAnge (SaaS/fintech/deeptech)." },
  { role: "Global Head of Sales", company: "ABAKA", link: "https://fr.linkedin.com/jobs/view/global-head-of-sales-at-abaka-3105106912", source: "LinkedIn", note: "SaaS, profil recherché : VP Sales / Sales Director." },
  { role: "Head of Sales France F/H", company: "Entreprise via APEC", link: "https://www.apec.fr/candidat/recherche-emploi.html/emploi/detail-offre/178913808W", source: "APEC", note: "Paris 9e." },
  { role: "Directeur Commercial F/H", company: "Entreprise via APEC", link: "https://www.apec.fr/candidat/recherche-emploi.html/emploi/detail-offre/178983990W", source: "APEC", note: "Paris 18e." },
  { role: "VP Sales H/F", company: "Skilleos", link: "https://fr.linkedin.com/jobs/view/vp-sales-h-f-at-skilleos-3257952726", source: "LinkedIn", note: "Membre du Comité de Direction, pilotage stratégie commerciale, objectif 10M€ CA." }
];

exports.handler = async () => {
  const store = scanStore();
  const existing = (await store.get("career-suggestions")) || [];
  const existingIds = new Set(existing.map(s => s.id));
  const today = new Date().toISOString().slice(0, 10);
  let added = 0;
  for (const s of MANUAL_FINDS) {
    const id = hashId(`${s.company}|${s.role}|${s.link}`.slice(0, 200));
    if (existingIds.has(id)) continue;
    existing.unshift({ id, role: s.role, company: s.company, link: s.link, source: s.source, note: s.note, date: today });
    existingIds.add(id);
    added++;
  }
  const capped = existing.slice(0, 150);
  await store.set("career-suggestions", capped);
  return { statusCode: 200, body: JSON.stringify({ added, total: capped.length, message: added > 0 ? `${added} offre(s) ajoutée(s) — va voir Opportunités Carrière dans l'app.` : "Déjà présentes, rien de nouveau à ajouter." }) };
};
