(()=>{
'use strict';
// Module additionnel : vue Analytics (section 18 du cahier des charges).
// Uniquement des métriques réellement calculables depuis les données
// existantes (prospects + leur timeline) -- pas de "CA potentiel/signé"
// puisqu'aucun champ de valeur de deal n'existe dans le schéma, et
// "inventer" un chiffre irait contre le principe d'honnêteté de toute
// l'app. Même limitation, même choix que le panneau "Aujourd'hui" du
// Dashboard.
function metric(n,l){return `<div class="metric"><b>${n}</b><span>${l}</span></div>`}

function renderAnalytics(){
 if(!window.Oligart)return;
 const {getProspects,esc}=window.Oligart;
 const list=getProspects();
 const elMetrics=document.querySelector('#analyticsMetrics');
 const elStatus=document.querySelector('#analyticsByStatus');
 const elCategory=document.querySelector('#analyticsByCategory');
 if(!elMetrics||!elStatus||!elCategory)return;

 let emailsSent=0;
 list.forEach(p=>(p.timeline||[]).forEach(e=>{if(e.channel==='email'&&e.status==='sent')emailsSent++}));

 const contacted=list.filter(p=>['Contacté','Réponse reçue','RDV pris'].includes(p.status)).length;
 const replied=list.filter(p=>['Réponse reçue','RDV pris'].includes(p.status)).length;
 const meetings=list.filter(p=>p.status==='RDV pris').length;
 const responseRate=contacted?Math.round((replied/contacted)*100):0;
 const meetingConversion=contacted?Math.round((meetings/contacted)*100):0;
 const activeProspects=list.filter(p=>p.status!=='À contacter').length;
 const scheduledFollowUps=list.filter(p=>p.nextFollowUp).length;

 elMetrics.innerHTML=[
  metric(emailsSent,'emails envoyés (total)'),
  metric(replied,'réponses'),
  metric(meetings,'RDV obtenus'),
  metric(responseRate+'%','taux de réponse'),
  metric(meetingConversion+'%','taux de conversion en RDV'),
  metric(list.length,'taille du pipeline'),
  metric(activeProspects,'prospects actifs'),
  metric(scheduledFollowUps,'relances programmées')
 ].join('');

 const byStatus={};
 list.forEach(p=>{byStatus[p.status]=(byStatus[p.status]||0)+1});
 elStatus.innerHTML=Object.entries(byStatus).sort((a,b)=>b[1]-a[1]).map(([st,n])=>
  `<div class="row"><b>${esc(st)}</b><span></span><span></span><span class="score">${n}</span></div>`
 ).join('')||'<p class="muted">Aucun prospect.</p>';

 const byCategory={};
 list.forEach(p=>{byCategory[p.category||'Non classé']=(byCategory[p.category||'Non classé']||0)+1});
 elCategory.innerHTML=Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).map(([cat,n])=>
  `<div class="row"><b>${esc(cat)}</b><span></span><span></span><span class="score">${n}</span></div>`
 ).join('')||'<p class="muted">Aucun prospect.</p>';
}
function init(){
 if(!window.Oligart)return;
 window.Oligart.registerRenderHook(renderAnalytics);
 renderAnalytics();
}
init();
})();
