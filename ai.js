(()=>{
'use strict';
// Assistant IA : injecte un panneau dans la fiche prospect avec 5 générations
// (Email, DM LinkedIn, Pitch, Préparation RDV, Compte rendu). Appelle la
// fonction Netlify /.netlify/functions/generate (Anthropic API côté serveur).
// Règle n°1 du projet : si l'API échoue (pas de clé, quota, réseau down...),
// on ne bloque JAMAIS l'utilisateur — un texte local de repli est toujours
// généré à la place, avec un message clair indiquant le mode utilisé.
const KINDS=[
 {id:'email',label:'Email'},
 {id:'linkedin_dm',label:'DM LinkedIn'},
 {id:'pitch',label:'Pitch'},
 {id:'meeting_prep',label:'Préparation RDV'},
 {id:'meeting_recap',label:'Compte rendu'}
];

function localFallback(kind,p,rawNotes){
 switch(kind){
  case 'email': return window.Oligart.messageFor(p);
  case 'linkedin_dm': return `Bonjour${p.ceoName?` ${p.ceoName}`:''}, je suis Rodolph Menten (Oligart). ${p.company} m'intéresse beaucoup${p.sector?` sur le secteur ${p.sector}`:''}. J'accompagne des entreprises en croissance sur leur go-to-market et structuration commerciale — seriez-vous ouvert à un échange rapide ?`;
  case 'pitch': return `Chez Oligart, j'aide des entreprises comme ${p.company} à structurer leur go-to-market, leur organisation commerciale et leurs partenariats. ${p.why||'Le contexte actuel de votre marché'} rend ce moment particulièrement pertinent pour accélérer. Je propose un format opérationnel et flexible, sans engagement long terme.`;
  case 'meeting_prep': return `Questions à poser :\n- Où en est ${p.company} sur sa structuration commerciale actuelle ?\n- Quels sont les objectifs de croissance des 12 prochains mois ?\n- Qui décide côté ${p.company} sur ce type de sujet ?\n\nPoints de valeur Oligart :\n- Go-to-market opérationnel et flexible\n- Réseau agences/annonceurs\n- Expérience structuration commerciale (Tagger Media, Mister Bell, Time Out)\n\nObjection probable : "On n'a pas le budget pour du conseil externe."\nRéponse : proposer un format court, cadré, avec objectif mesurable avant tout engagement plus large.`;
  case 'meeting_recap': return `Compte rendu (généré localement, à relire) :\n\n${rawNotes||'Aucune note fournie.'}`;
  default: return '';
 }
}

async function generate(kind,p,rawNotes){
 try{
  const r=await fetch('/.netlify/functions/generate',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({kind,prospect:{company:p.company,sector:p.sector,ceoName:p.ceoName,headOfSalesName:p.headOfSalesName,targetRole:p.targetRole,why:p.why,notes:p.notes},rawNotes})
  });
  const data=await r.json();
  if(!r.ok||!data.text)throw new Error(data.error||'Réponse IA vide');
  return {text:data.text,source:'ia'};
 }catch(e){
  return {text:localFallback(kind,p,rawNotes),source:'local'};
 }
}

function renderDrawerAI(id){
 const dEl=document.querySelector('#drawerExtra');
 if(!dEl||!window.Oligart)return;
 const p=window.Oligart.getProspect(id);
 if(!p)return;
 const block=document.createElement('div');
 block.className='panel';
 block.style.marginTop='18px';
 block.innerHTML=`<div class="panel-head"><h3>Assistant IA</h3><span class="muted">Génère un brouillon, toujours modifiable</span></div>
  <div class="actions">${KINDS.map(k=>`<button class="btn secondary" data-ai="${k.id}">${k.label}</button>`).join('')}</div>
  <label class="wide" style="display:none" id="aiNotesWrap">Notes brutes du RDV<textarea id="aiNotes" placeholder="Colle ici tes notes prises pendant le rendez-vous"></textarea></label>
  <p class="muted" id="aiStatus"></p>
  <textarea class="message" id="aiOutput" placeholder="Le texte généré apparaîtra ici..."></textarea>
  <div class="actions"><button id="aiCopy" class="btn secondary">Copier</button></div>`;
 dEl.appendChild(block);
 const notesWrap=block.querySelector('#aiNotesWrap');
 const status=block.querySelector('#aiStatus');
 const output=block.querySelector('#aiOutput');
 block.querySelectorAll('[data-ai]').forEach(btn=>btn.onclick=async()=>{
  const kind=btn.dataset.ai;
  notesWrap.style.display=kind==='meeting_recap'?'grid':'none';
  if(kind==='meeting_recap'&&!block.querySelector('#aiNotes').value.trim()){
   status.textContent='Colle tes notes de RDV ci-dessus avant de générer le compte rendu.';
   return;
  }
  status.textContent='Génération en cours...';
  output.value='';
  const rawNotes=block.querySelector('#aiNotes')?.value||'';
  const {text,source}=await generate(kind,p,rawNotes);
  output.value=text;
  status.textContent=source==='ia'?'Généré par l’assistant IA.':'IA indisponible — texte de repli généré localement (toujours modifiable).';
 });
 block.querySelector('#aiCopy').onclick=async()=>{
  if(!output.value)return;
  await navigator.clipboard.writeText(output.value);
  window.Oligart.toast('Texte copié');
 };
}

function init(){
 if(!window.Oligart)return;
 document.addEventListener('oligart:prospect-opened',e=>{
  try{renderDrawerAI(e.detail.id)}catch(err){console.warn('[oligart] ai drawer render failed:',err)}
 });
}
init();
})();
