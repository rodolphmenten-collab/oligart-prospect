(()=>{
'use strict';
// Radar Marché : journal de signaux (levée de fonds, recrutement, ouverture pays,
// changement CEO/CRO) rattachés à chaque prospect. Deux sources fusionnées :
// 1) signaux ajoutés manuellement par Rodolph depuis une fiche prospect
// 2) signaux détectés automatiquement chaque jour côté serveur (scan planifié
//    Netlify + recherche web réelle), stockés centralement (Netlify Blobs) —
//    visibles depuis n'importe quel appareil, pas seulement en local.
// Si le scan automatique n'est pas configuré ou indisponible, le radar
// continue de fonctionner avec les seuls signaux manuels : jamais bloquant.
const TYPES=[
 {id:'funding',label:'Levée de fonds'},
 {id:'hiring',label:'Recrutement (croissance équipe)'},
 {id:'expansion',label:'Ouverture nouveau pays'},
 {id:'ceo_change',label:'Changement de CEO'},
 {id:'cro_change',label:'Changement de CRO / Head of Sales'}
];
const TYPE_LABEL=Object.fromEntries(TYPES.map(t=>[t.id,t.label]));

let serverSignals=[];
let serverLastRun=null;
let serverFetched=false;

async function fetchServerSignals(){
 try{
  const r=await fetch('/.netlify/functions/radar-data');
  if(!r.ok)throw new Error('radar-data indisponible');
  const data=await r.json();
  serverSignals=Array.isArray(data.signals)?data.signals:[];
  serverLastRun=data.lastRun||null;
 }catch{
  // Pas de scan automatique configuré/disponible : le radar reste utilisable
  // avec les seuls signaux manuels, sans message d'erreur intrusif.
  serverSignals=[];serverLastRun=null;
 }
 serverFetched=true;
 renderRadar();
}

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
 const byId=Object.fromEntries(getProspects().map(p=>[p.id,p]));
 const all=[];
 getProspects().forEach(p=>(p.signals||[]).forEach(s=>all.push({...s,company:p.company,id:p.id,auto:false})));
 serverSignals.forEach(s=>{const p=byId[s.prospectId];if(p)all.push({...s,id:p.id,auto:true})});
 const list=all.filter(s=>!filter||s.type===filter).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,150);
 const statusLine=serverFetched?(serverLastRun?`Dernier scan automatique : ${esc(serverLastRun)}`:'Scan automatique pas encore configuré ou pas encore exécuté — signaux manuels uniquement.'):'';
 const statusHtml=statusLine?`<p class="muted" style="margin:-6px 0 12px">${statusLine}</p>`:'';
 if(!list.length){el.innerHTML=statusHtml+'<p class="muted">Aucun signal enregistré. Ouvre une fiche prospect pour en ajouter un, ou attends le prochain scan automatique.</p>';return}
 el.innerHTML=statusHtml+list.map(s=>`<div class="row row-5" data-id="${esc(s.id)}"><b>${esc(s.company)}</b><span class="pill">${esc(TYPE_LABEL[s.type]||s.type)}${s.auto?' · auto':''}</span><span>${esc(s.note||'')}</span><span class="muted">${esc(s.date)}</span><span></span></div>`).join('');
 el.querySelectorAll('[data-id]').forEach(r=>r.onclick=()=>window.Oligart.openProspect(r.dataset.id));
}

function renderDrawerRadar(id){
 const dEl=document.querySelector('#drawerExtra');
 if(!dEl||!window.Oligart)return;
 const p=window.Oligart.getProspect(id);
 if(!p)return;
 const {esc}=window.Oligart;
 const manual=(p.signals||[]).map(s=>({...s,auto:false}));
 const auto=serverSignals.filter(s=>s.prospectId===id).map(s=>({...s,auto:true}));
 const merged=[...manual,...auto].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
 const list=merged.map(s=>`<li><span class="muted">${esc(s.date)} · ${esc(TYPE_LABEL[s.type]||s.type)}${s.auto?' · détecté auto':''}</span> — ${esc(s.note||'')}</li>`).join('')||'<li class="muted">Aucun signal pour cette entreprise.</li>';
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
 fetchServerSignals();
 document.addEventListener('oligart:prospect-opened',e=>{
  try{renderDrawerRadar(e.detail.id)}catch(err){console.warn('[oligart] radar drawer render failed:',err)}
 });
}
init();
})();
