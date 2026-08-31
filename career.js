(()=>{
'use strict';
// Opportunités Carrière : suivi des postes de direction commerciale que Rodolph
// repère (VP Sales, GM, Country Manager, CRO, Head of Sales). Stockage local
// indépendant du fichier prospects (ne touche jamais window.Oligart / app.js),
// donc une erreur ici ne peut jamais casser la base de 200 entreprises.
const ROLES=['VP Sales','GM / General Manager','Country Manager','CRO','Head of Sales','Autre'];
const STATUSES=['À examiner','Candidature envoyée','Entretien','Offre reçue','Refusé','Abandonné'];
const KEY='oligart-career-opportunities';
const DISMISSED_KEY='oligart-career-dismissed-suggestions';
const esc=v=>String(v||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);

let opportunities=[];
let suggestions=[];
let suggestionsLastRun=null;
let freeJobs=[];
let freeJobsLastRun=null;
const FREE_STATUS_LABELS={new:'Nouveau',saved:'Sauvegardé',to_apply:'À candidater',applied:'Candidature envoyée',interview:'Entretien',rejected:'Refusé',archived:'Archivé'};
const TIER_LABELS={excellent:'🔥 Excellent match',good:'🟢 Bon match',watch:'🟡 À regarder'};
function load(){
 try{const stored=JSON.parse(localStorage.getItem(KEY)||'null');opportunities=Array.isArray(stored)?stored:[]}
 catch{opportunities=[]}
}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(opportunities))}catch{/* stockage plein ou indisponible : on continue sans persister */}}
function loadDismissed(){try{const d=JSON.parse(localStorage.getItem(DISMISSED_KEY)||'null');return Array.isArray(d)?new Set(d):new Set()}catch{return new Set()}}
function persistDismissed(set){try{localStorage.setItem(DISMISSED_KEY,JSON.stringify([...set]))}catch{/* non bloquant */}}

function companyLabel(o){
 // Le nom devient un lien direct vers l'offre quand on en a une : c'est le
 // "1 clic pour postuler" — ouvre directement l'annonce sur le site source.
 return o.link ? `<a href="${esc(o.link)}" target="_blank" rel="noopener" title="Ouvrir l'offre et postuler">${esc(o.company)} ↗</a>` : esc(o.company);
}

function row(o){
 return `<div class="row row-5" data-id="${o.id}"><b>${companyLabel(o)}</b><span>${esc(o.role)}</span><span class="muted">${esc(o.source||'—')}</span><select data-status="${o.id}">${STATUSES.map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}</select><button class="link-btn" data-del="${o.id}">Supprimer</button></div>`;
}

async function fetchSuggestions(){
 try{
  const r=await fetch('/.netlify/functions/career-data');
  if(!r.ok)throw new Error('career-data indisponible');
  const data=await r.json();
  suggestions=Array.isArray(data.suggestions)?data.suggestions:[];
  suggestionsLastRun=data.lastRun||null;
 }catch{
  // Scan automatique pas configuré/disponible : le pipeline manuel continue
  // de fonctionner normalement, sans message d'erreur intrusif.
  suggestions=[];suggestionsLastRun=null;
 }
 renderSuggestions();
}

// --- Offres gratuites (Greenhouse/Lever, scorées localement, sans IA) ---
async function fetchFreeJobs(){
 try{
  const r=await fetch('/.netlify/functions/career-free-data');
  if(!r.ok)throw new Error('career-free-data indisponible');
  const data=await r.json();
  freeJobs=Array.isArray(data.jobs)?data.jobs:[];
  freeJobsLastRun=data.lastRun||null;
 }catch{
  freeJobs=[];freeJobsLastRun=null;
 }
 renderFreeJobs();
}

function freeJobRow(j){
 const tierBadge=j.tier?`<span class="pill">${esc(TIER_LABELS[j.tier]||j.tier)}</span>`:'';
 const reasons=(j.scoreReasons||[]).slice(0,6).map(esc).join(' · ');
 return `<div class="row row-5" data-fp="${esc(j.fingerprint)}">
  <b><a href="${esc(j.applyUrl||j.sourceUrl)}" target="_blank" rel="noopener">${esc(j.title)} ↗</a><br><span class="muted">${esc(j.company)} · ${esc(j.location||'lieu non précisé')}</span></b>
  <span>${j.score}/100</span>
  ${tierBadge}
  <span class="muted" title="${reasons}">${reasons.slice(0,60)}${reasons.length>60?'…':''}</span>
  <select data-status-fp="${esc(j.fingerprint)}">${Object.entries(FREE_STATUS_LABELS).map(([v,l])=>`<option value="${v}" ${j.status===v?'selected':''}>${l}</option>`).join('')}</select>
 </div>`;
}

async function updateFreeJobStatus(fingerprint,status){
 const job=freeJobs.find(j=>j.fingerprint===fingerprint);
 if(job)job.status=status; // mise à jour optimiste, immédiate à l'écran
 try{
  await fetch('/.netlify/functions/career-free-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fingerprint,status})});
 }catch{
  // La sauvegarde côté serveur peut échouer sans bloquer l'usage local -- le
  // statut survivra jusqu'au prochain rafraîchissement de la page seulement.
 }
}

function renderFreeJobs(){
 const el=document.querySelector('#careerFreeJobs');
 const statusEl=document.querySelector('#careerFreeStatus');
 if(!el)return;
 if(statusEl)statusEl.textContent=freeJobsLastRun?`Dernier scan : ${freeJobsLastRun}`:'Aucun scan effectué pour l\'instant.';
 const visible=freeJobs.filter(j=>(j.score||0)>=60 && j.status!=='archived' && j.status!=='rejected').sort((a,b)=>(b.score||0)-(a.score||0)||(b.publishedAt||'').localeCompare(a.publishedAt||''));
 if(!visible.length){
  el.innerHTML='<p class="muted">Aucune offre à score ≥60 pour l\'instant. Clique "Actualiser les offres" pour lancer un scan (gratuit, Greenhouse + Lever, sans IA).</p>';
  return;
 }
 const groups=[['excellent','excellent'],['good','good'],['watch','watch']];
 el.innerHTML=groups.map(([tier])=>{
  const items=visible.filter(j=>j.tier===tier);
  if(!items.length)return '';
  return `<p class="muted" style="margin:14px 0 6px"><b>${TIER_LABELS[tier]}</b> (${items.length})</p>${items.map(freeJobRow).join('')}`;
 }).join('');
 el.querySelectorAll('[data-status-fp]').forEach(sel=>sel.onchange=()=>updateFreeJobStatus(sel.dataset.statusFp,sel.value));
}

async function pollFreeCareerScan(attempt){
 const statusEl=document.querySelector('#careerFreeStatus');
 const btn=document.querySelector('#careerFreeRefresh');
 if(attempt>25){ // ~100s max
  if(statusEl)statusEl.textContent='Le scan met plus de temps que prévu à répondre. Il continue en arrière-plan -- reviens vérifier dans une minute.';
  if(btn)btn.disabled=false;
  return;
 }
 try{
  const r=await fetch('/.netlify/functions/career-free-scan-status');
  const data=await r.json();
  if(data.state==='done'){
   if(data.error){
    if(statusEl)statusEl.textContent=`Scan indisponible (${data.error}).`;
   }else{
    const result=data.result||{};
    const okList=(result.sitesOk||[]).length;
    const failList=(result.sitesFailed||[]).length;
    // renderFreeJobs() (appelé par fetchFreeJobs) réécrit ce champ avec un
    // message générique -- le nôtre, plus précis, doit passer APRÈS pour ne
    // pas être écrasé immédiatement.
    await fetchFreeJobs();
    if(statusEl)statusEl.textContent=`Scan terminé : ${result.added} nouvelle(s) offre(s), ${result.updated} mise(s) à jour. ${okList} source(s) OK${failList?`, ${failList} en échec (voir career-companies.json ou clés API)`:''}.`;
    if(window.Oligart)window.Oligart.toast('Scan carrière terminé');
   }
   if(btn)btn.disabled=false;
   return;
  }
 }catch{/* on retente simplement au prochain intervalle */}
 setTimeout(()=>pollFreeCareerScan(attempt+1),4000);
}

async function refreshFreeJobs(){
 const btn=document.querySelector('#careerFreeRefresh');
 const statusEl=document.querySelector('#careerFreeStatus');
 if(btn)btn.disabled=true;
 if(statusEl)statusEl.textContent='Scan lancé (Greenhouse, Lever, France Travail, LinkedIn, WTTJ, APEC)... suivi en cours, ça peut prendre 30 à 90 secondes.';
 try{
  const r=await fetch('/.netlify/functions/career-free-trigger',{method:'POST'});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||`Scan indisponible (code ${r.status})`);
  pollFreeCareerScan(0);
 }catch(e){
  if(statusEl)statusEl.textContent=`Scan indisponible (${e.message}).`;
  if(btn)btn.disabled=false;
 }
}

function acceptSuggestion(s){
 opportunities.unshift({
  id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())),
  role:s.role,company:s.company,link:s.link||'',source:s.source||'Détecté automatiquement',
  notes:s.note||'',status:'À examiner',dateFound:today()
 });
 persist();
 const dismissed=loadDismissed();dismissed.add(s.id);persistDismissed(dismissed);
 render();renderSuggestions();
 if(window.Oligart)window.Oligart.toast('Ajouté à ton pipeline');
}

function dismissSuggestion(s){
 const dismissed=loadDismissed();dismissed.add(s.id);persistDismissed(dismissed);
 renderSuggestions();
}

function renderSuggestions(){
 const el=document.querySelector('#careerSuggestions');
 if(!el)return;
 const dismissed=loadDismissed();
 const visible=suggestions.filter(s=>!dismissed.has(s.id));
 if(!visible.length){
  el.innerHTML=suggestionsLastRun?`<p class="muted" style="margin-bottom:14px">Dernier scan automatique : ${esc(suggestionsLastRun)} — aucune nouvelle suggestion pour l'instant.</p>`:'';
  return;
 }
 el.innerHTML=`<div class="panel" style="margin-bottom:18px;border-color:#3a3a2a"><div class="panel-head"><h3>Suggestions détectées automatiquement</h3><span class="muted">${suggestionsLastRun?'Scan du '+esc(suggestionsLastRun):''}</span></div>${visible.map(s=>`<div class="row row-5"><b>${companyLabel(s)}</b><span>${esc(s.role)}</span><span class="muted">${esc(s.note||s.source||'')}</span><button class="btn secondary" data-accept="${s.id}">Ajouter</button><button class="link-btn" data-dismiss="${s.id}">Ignorer</button></div>`).join('')}</div>`;
 el.querySelectorAll('[data-accept]').forEach(btn=>btn.onclick=()=>{const s=suggestions.find(x=>x.id===btn.dataset.accept);if(s)acceptSuggestion(s)});
 el.querySelectorAll('[data-dismiss]').forEach(btn=>btn.onclick=()=>{const s=suggestions.find(x=>x.id===btn.dataset.dismiss);if(s)dismissSuggestion(s)});
}

function render(){
 const list=document.querySelector('#careerList');
 if(!list)return; // vue pas encore dans le DOM : on ne fait rien, jamais d'erreur
 if(!opportunities.length){
  list.innerHTML='<p class="muted">Aucune opportunité suivie pour l’instant. Ajoute un poste (VP Sales, GM, Country Manager, CRO, Head of Sales...) pour commencer ton pipeline carrière.</p>';
  return;
 }
 const sorted=[...opportunities].sort((a,b)=>(b.dateFound||'').localeCompare(a.dateFound||''));
 list.innerHTML=sorted.map(row).join('');
 list.querySelectorAll('[data-status]').forEach(sel=>sel.onchange=()=>{
  const o=opportunities.find(x=>x.id===sel.dataset.status);
  if(o){o.status=sel.value;persist()}
 });
 list.querySelectorAll('[data-del]').forEach(btn=>btn.onclick=()=>{
  if(!confirm('Supprimer cette opportunité ?'))return;
  opportunities=opportunities.filter(o=>o.id!==btn.dataset.del);
  persist();render();
 });
}

function init(){
 load();
 const roleSel=document.querySelector('#cRole');
 if(roleSel && !roleSel.dataset.built){roleSel.dataset.built='1';roleSel.innerHTML=ROLES.map(r=>`<option>${r}</option>`).join('')}
 const toggle=document.querySelector('#careerAddToggle');
 const form=document.querySelector('#careerForm');
 if(toggle&&form){toggle.onclick=()=>{form.style.display=form.style.display==='none'?'grid':'none'}}
 if(form){
  form.onsubmit=e=>{
   e.preventDefault();
   const company=document.querySelector('#cCompany').value.trim();
   if(!company)return;
   opportunities.unshift({
    id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())),
    role:document.querySelector('#cRole').value,
    company,
    link:document.querySelector('#cLink').value.trim(),
    source:document.querySelector('#cSource').value.trim(),
    notes:document.querySelector('#cNotes').value.trim(),
    status:'À examiner',
    dateFound:today()
   });
   persist();
   form.reset();
   form.style.display='none';
   render();
  };
 }
 render();
}
try{init()}catch(e){console.warn('[oligart] career module failed to init, rest of app unaffected:',e)}
fetchSuggestions();
fetchFreeJobs();
const freeRefreshBtn=document.querySelector('#careerFreeRefresh');
if(freeRefreshBtn)freeRefreshBtn.onclick=refreshFreeJobs;
})();
