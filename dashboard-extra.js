(()=>{
'use strict';
// Complète le Dashboard avec deux widgets additionnels : Opportunités (pipeline
// carrière) et Activité récente (fusion timeline outreach + signaux radar).
// Purement additif : n'écrit jamais dans les données prospects/carrière,
// se contente de les lire pour affichage. Si les éléments cibles n'existent
// pas dans le DOM (ancienne version d'index.html), le module ne fait rien.
function loadCareer(){
 try{const s=JSON.parse(localStorage.getItem('oligart-career-opportunities')||'null');return Array.isArray(s)?s:[]}
 catch{return []}
}

function renderOpportunities(){
 const el=document.querySelector('#opportunitiesWidget');
 if(!el)return;
 const opps=loadCareer();
 if(!opps.length){el.innerHTML='<p class="muted">Aucun poste en veille. Ajoute-en un depuis « Opportunités Carrière ».</p>';return}
 const active=opps.filter(o=>!['Refusé','Abandonné'].includes(o.status));
 const counts={};
 active.forEach(o=>counts[o.status]=(counts[o.status]||0)+1);
 el.innerHTML=Object.entries(counts).map(([status,n])=>`<div class="row"><b>${status}</b><span></span><span></span><span class="pill">${n}</span></div>`).join('')||'<p class="muted">Toutes les opportunités suivies sont closes.</p>';
}

function renderActivity(){
 const el=document.querySelector('#activityWidget');
 if(!el||!window.Oligart)return;
 const {getProspects,esc}=window.Oligart;
 const events=[];
 getProspects().forEach(p=>{
  (p.timeline||[]).forEach(t=>events.push({date:t.date,label:`${p.company} · ${t.note||t.channel}`}));
  (p.signals||[]).forEach(s=>events.push({date:s.date,label:`Signal — ${p.company} : ${s.note||s.type}`}));
 });
 events.sort((a,b)=>b.date.localeCompare(a.date));
 const recent=events.slice(0,8);
 el.innerHTML=recent.length?recent.map(e=>`<div class="row"><b>${esc(e.label)}</b><span></span><span></span><span class="muted">${esc(e.date)}</span></div>`).join(''):'<p class="muted">Aucune activité enregistrée pour l’instant.</p>';
}

function renderDashboardExtra(){renderOpportunities();renderActivity()}

function init(){
 renderDashboardExtra(); // premier rendu immédiat
 if(window.Oligart)window.Oligart.registerRenderHook(renderDashboardExtra);
}
try{init()}catch(e){console.warn('[oligart] dashboard-extra failed to init, rest of app unaffected:',e)}
})();
