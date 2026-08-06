(()=>{
'use strict';
// Module additionnel : Top 30 des prospects à plus fort potentiel.
// Ne dépend que de l'API partagée window.Oligart (jamais du DOM interne d'app.js).
// Si window.Oligart n'existe pas encore (chargement, erreur), on n'affiche rien
// de cassé : le hook est simplement ignoré, le reste de l'app continue.
function renderPriorities(){
 if(!window.Oligart)return;
 const {getProspects,esc}=window.Oligart;
 const el=document.querySelector('#priorityTop30');
 if(!el)return;
 const top30=[...getProspects()].sort((a,b)=>b.score-a.score).slice(0,30);
 if(!top30.length){el.innerHTML='<p class="muted">Aucun prospect chargé.</p>';return}
 el.innerHTML=top30.map((p,i)=>`<div class="row row-5" data-id="${esc(p.id)}"><b>#${i+1} ${esc(p.company)}</b><span>${esc(p.sector)}</span><span class="muted">${esc(p.ceoName||'CEO à identifier')}</span><span class="score">${p.score}</span><span class="pill">${esc(p.status)}</span></div>`).join('');
 el.querySelectorAll('[data-id]').forEach(r=>r.onclick=()=>window.Oligart.openProspect(r.dataset.id));
}
function init(){
 if(!window.Oligart)return;
 window.Oligart.registerRenderHook(renderPriorities);
 renderPriorities(); // premier rendu immédiat, sans attendre une action utilisateur
}
init();
})();
