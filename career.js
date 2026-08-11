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
})();
