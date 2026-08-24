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

function renderNoAgency(){
 const el=document.querySelector('#noAgencyWidget');
 if(!el||!window.Oligart)return;
 const {getProspects,esc,openProspect}=window.Oligart;
 const confirmed=getProspects().filter(p=>p.hasAgency===false).sort((a,b)=>b.score-a.score);
 const likely=getProspects().filter(p=>p.likelyNoAgency).sort((a,b)=>b.score-a.score).slice(0,10);
 if(!confirmed.length&&!likely.length){el.innerHTML='<p class="muted">Aucun annonceur sans agence identifié pour l’instant.</p>';return}
 const row=(p,tag)=>`<div class="row row-5" data-id="${esc(p.id)}"><b>${esc(p.company)}</b><span>${esc(p.sector)}</span><span class="score">${p.score}</span><span class="pill">${tag}</span><span></span></div>`;
 let html='';
 if(confirmed.length)html+=`<p class="muted" style="margin:0 0 6px"><b>Confirmé</b> (${confirmed.length})</p>`+confirmed.map(p=>row(p,'Confirmé')).join('');
 if(likely.length)html+=`<p class="muted" style="margin:14px 0 6px"><b>Probable</b> — PME budget modeste, top 10 sur ${getProspects().filter(p=>p.likelyNoAgency).length}</p>`+likely.map(p=>row(p,'Probable')).join('');
 el.innerHTML=html;
 el.querySelectorAll('[data-id]').forEach(r=>r.onclick=()=>openProspect(r.dataset.id));
}

function renderDashboardExtra(){renderOpportunities();renderActivity();renderNoAgency()}

function init(){
 renderDashboardExtra(); // premier rendu immédiat
 if(window.Oligart)window.Oligart.registerRenderHook(renderDashboardExtra);
}
try{init()}catch(e){console.warn('[oligart] dashboard-extra failed to init, rest of app unaffected:',e)}
})();
