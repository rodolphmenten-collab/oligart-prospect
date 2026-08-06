(()=>{
'use strict';
// Radar Marché : journal de signaux (levée de fonds, recrutement, ouverture pays,
// changement CEO/CRO) rattachés à chaque prospect. Pas d'API externe branchée ici
// (aucune clé de données financières/emploi n'est disponible côté client) —
// Rodolph loggue les signaux qu'il repère (LinkedIn, presse, alertes) et le radar
// les centralise, triés par date, filtrables par type. Aucune donnée inventée.
const TYPES=[
 {id:'funding',label:'Levée de fonds'},
 {id:'hiring',label:'Recrutement (croissance équipe)'},
 {id:'expansion',label:'Ouverture nouveau pays'},
 {id:'ceo_change',label:'Changement de CEO'},
 {id:'cro_change',label:'Changement de CRO / Head of Sales'}
];
const TYPE_LABEL=Object.fromEntries(TYPES.map(t=>[t.id,t.label]));

function ensureFilterOptions(){
 const sel=document.querySelector('#radarFilter');
 if(!sel||sel.dataset.built)return;
 sel.dataset.built='1';
 TYPES.forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.label;sel.appendChild(o)});
 sel.addEventListener('change',renderRadar);
}

function renderRadar(){
 if(!window.Oligart)return;
 ensureFilterOptions();
 const {getProspects,esc}=window.Oligart;
 const el=document.querySelector('#radarList');
 if(!el)return;
 const filter=document.querySelector('#radarFilter')?.value||'';
 const all=[];
 getProspects().forEach(p=>(p.signals||[]).forEach(s=>all.push({...s,company:p.company,id:p.id})));
 const list=all.filter(s=>!filter||s.type===filter).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,150);
 if(!list.length){el.innerHTML='<p class="muted">Aucun signal enregistré. Ouvre une fiche prospect pour en ajouter un.</p>';return}
 el.innerHTML=list.map(s=>`<div class="row row-5" data-id="${esc(s.id)}"><b>${esc(s.company)}</b><span class="pill">${esc(TYPE_LABEL[s.type]||s.type)}</span><span>${esc(s.note||'')}</span><span class="muted">${esc(s.date)}</span><span></span></div>`).join('');
 el.querySelectorAll('[data-id]').forEach(r=>r.onclick=()=>window.Oligart.openProspect(r.dataset.id));
}

function renderDrawerRadar(id){
 const dEl=document.querySelector('#drawerExtra');
 if(!dEl||!window.Oligart)return;
 const p=window.Oligart.getProspect(id);
 if(!p)return;
 const {esc}=window.Oligart;
 const list=(p.signals||[]).slice(0,5).map(s=>`<li><span class="muted">${esc(s.date)} · ${esc(TYPE_LABEL[s.type]||s.type)}</span> — ${esc(s.note||'')}</li>`).join('')||'<li class="muted">Aucun signal pour cette entreprise.</li>';
 const block=document.createElement('div');
 block.className='panel';
 block.style.marginTop='18px';
 block.innerHTML=`<div class="panel-head"><h3>Radar Marché</h3><span class="muted">Signaler un événement</span></div><div class="detail-grid"><label>Type<select id="rType">${TYPES.map(t=>`<option value="${t.id}">${t.label}</option>`).join('')}</select></label><label>Source (URL, optionnel)<input id="rSource" placeholder="https://..."></label><label class="wide">Note<input id="rNote" placeholder="Ex : levée de 4M€ en Seed, annoncée sur LinkedIn"></label></div><div class="actions"><button id="rAdd" class="btn secondary">Ajouter le signal</button></div><ul class="muted" style="padding-left:18px;line-height:1.7">${list}</ul>`;
 dEl.appendChild(block);
 block.querySelector('#rAdd').onclick=()=>{
  const note=block.querySelector('#rNote').value.trim();
  if(!note)return window.Oligart.toast('Ajoute une note pour le signal');
  window.Oligart.addSignal(p,{type:block.querySelector('#rType').value,note,source:block.querySelector('#rSource').value.trim()});
  window.Oligart.toast('Signal ajouté');
  renderDrawerRadar(id);
 };
}

function init(){
 if(!window.Oligart)return;
 window.Oligart.registerRenderHook(renderRadar);
 renderRadar();
 document.addEventListener('oligart:prospect-opened',e=>{
  try{renderDrawerRadar(e.detail.id)}catch(err){console.warn('[oligart] radar drawer render failed:',err)}
 });
}
init();
})();
