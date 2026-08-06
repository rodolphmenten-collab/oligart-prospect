(()=>{
'use strict';
// Opportunités Carrière : suivi des postes de direction commerciale que Rodolph
// repère (VP Sales, GM, Country Manager, CRO, Head of Sales). Stockage local
// indépendant du fichier prospects (ne touche jamais window.Oligart / app.js),
// donc une erreur ici ne peut jamais casser la base de 200 entreprises.
const ROLES=['VP Sales','GM / General Manager','Country Manager','CRO','Head of Sales','Autre'];
const STATUSES=['À examiner','Candidature envoyée','Entretien','Offre reçue','Refusé','Abandonné'];
const KEY='oligart-career-opportunities';
const esc=v=>String(v||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);

let opportunities=[];
function load(){
 try{const stored=JSON.parse(localStorage.getItem(KEY)||'null');opportunities=Array.isArray(stored)?stored:[]}
 catch{opportunities=[]}
}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(opportunities))}catch{/* stockage plein ou indisponible : on continue sans persister */}}

function row(o){
 return `<div class="row row-5" data-id="${o.id}"><b>${esc(o.company)}</b><span>${esc(o.role)}</span><span class="muted">${esc(o.source||'—')}</span><select data-status="${o.id}">${STATUSES.map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}</select><button class="link-btn" data-del="${o.id}">Supprimer</button></div>`;
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
})();
