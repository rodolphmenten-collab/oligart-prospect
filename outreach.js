(()=>{
'use strict';
// Module Outreach : séquence multi-canal (email → LinkedIn → relance → téléphone)
// + historique par prospect. Dépend uniquement de window.Oligart (API partagée).
// Aucune fonction ici ne modifie directement app.js : tout passe par
// addTimelineEntry/save, donc une erreur ici ne peut pas corrompre l'état core.
const SEQUENCE=[
 {step:0,channel:'email',label:'Email de prise de contact',delayDays:4},
 {step:1,channel:'linkedin',label:'Relance LinkedIn',delayDays:5},
 {step:2,channel:'email',label:'Relance email',delayDays:5},
 {step:3,channel:'phone',label:'Appel téléphonique',delayDays:0}
];
const CHANNEL_LABEL={email:'Email',linkedin:'LinkedIn',phone:'Téléphone',auto:'Email (auto)'};

function stepFor(p){return SEQUENCE[p.sequenceStep]||null}

function logOutreach(p,channel,note){
 const {addTimelineEntry,today}=window.Oligart;
 const step=stepFor(p);
 addTimelineEntry(p,{channel,type:'manual',note:note||(step?step.label:'Contact manuel')});
 p.lastContact=today();
 if(step){
  p.sequenceStep=Math.min(p.sequenceStep+1,SEQUENCE.length);
  const next=SEQUENCE[p.sequenceStep];
  p.nextFollowUp=next?today(next.delayDays):'';
 }
 if(p.status==='À contacter')p.status='Contacté';
 window.Oligart.save();
 window.Oligart.toast('Étape enregistrée');
}

function renderOutreach(){
 if(!window.Oligart)return;
 const {getProspects,esc,today}=window.Oligart;
 const el=document.querySelector('#outreachDue');
 if(!el)return;
 const active=getProspects().filter(p=>!['Gagné','Perdu'].includes(p.status));
 const due=active.filter(p=>!p.nextFollowUp||p.nextFollowUp<=today()).sort((a,b)=>b.score-a.score).slice(0,60);
 if(!due.length){el.innerHTML='<p class="muted">Aucune action de prospection due pour le moment.</p>';return}
 el.innerHTML=due.map(p=>{
  const step=stepFor(p);
  const label=step?step.label:'Séquence terminée — suivi manuel';
  return `<div class="row row-5" data-id="${esc(p.id)}"><b>${esc(p.company)}</b><span>${esc(p.sector)}</span><span class="muted">${esc(label)}</span><span class="score">${p.score}</span><span class="pill">${esc(p.status)}</span></div>`;
 }).join('');
 el.querySelectorAll('[data-id]').forEach(r=>r.onclick=()=>window.Oligart.openProspect(r.dataset.id));
}

function renderDrawerOutreach(id){
 const dEl=document.querySelector('#drawerExtra');
 if(!dEl||!window.Oligart)return;
 const p=window.Oligart.getProspect(id);
 if(!p)return;
 const step=stepFor(p);
 const stepLabel=step?`Prochaine étape : <b>${window.Oligart.esc(step.label)}</b>`:'Séquence terminée — suivi manuel';
 const history=(p.timeline||[]).slice(0,6).map(t=>`<li><span class="muted">${window.Oligart.esc(t.date)} · ${window.Oligart.esc(CHANNEL_LABEL[t.channel]||t.channel)}</span> — ${window.Oligart.esc(t.note||'')}</li>`).join('')||'<li class="muted">Aucun contact enregistré pour l’instant.</li>';
 const block=document.createElement('div');
 block.className='panel';
 block.style.marginTop='18px';
 block.innerHTML=`<div class="panel-head"><h3>Outreach</h3><span class="muted">${stepLabel}</span></div><div class="actions"><button data-log="email" class="btn secondary">Logger Email</button><button data-log="linkedin" class="btn secondary">Logger LinkedIn</button><button data-log="phone" class="btn secondary">Logger Appel</button></div><ul class="muted" style="padding-left:18px;line-height:1.7">${history}</ul>`;
 dEl.appendChild(block);
 block.querySelectorAll('[data-log]').forEach(btn=>btn.onclick=()=>{logOutreach(p,btn.dataset.log);renderDrawerOutreach(id)});
}

function init(){
 if(!window.Oligart)return;
 window.Oligart.registerRenderHook(renderOutreach);
 renderOutreach();
 document.addEventListener('oligart:prospect-opened',e=>{
  try{renderDrawerOutreach(e.detail.id)}catch(err){console.warn('[oligart] outreach drawer render failed:',err)}
 });
}
init();
})();
