(()=>{
'use strict';
const VERSION='clean-2026-08-06-v1';
const STATUSES=['À contacter','Contacté','Réponse reçue','RDV pris','Proposition envoyée','Gagné','À relancer','Perdu'];
const BOARD_STATUSES=['À contacter','Contacté','Réponse reçue','RDV pris','Proposition envoyée'];
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clone=o=>JSON.parse(JSON.stringify(o));
const today=(n=0)=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
let prospects=[]; let selected=null;
// Champs "possédés" par l'utilisateur : jamais écrasés par une mise à jour du
// fichier source (data.js). Tout le reste (nom, secteur, catégorie, score,
// why généré, hasAgency...) se met à jour automatiquement depuis la nouvelle
// base à chaque chargement -- exactement ce qui manquait jusqu'ici : avant ce
// correctif, il fallait cliquer "Restaurer" pour voir les nouveaux prospects,
// ce qui effaçait au passage tout le travail de prospection déjà fait.
const EDITABLE_FIELDS=['status','priority','contactName','contactEmail','contactLinkedin','contact2Name','contact2Role','contact2Email','contact2Linkedin','ceoName','ceoLinkedin','ceoEmail','headOfSalesName','headOfSalesLinkedin','headOfSalesEmail','phone','why','notes','targetRole','lastContact','nextFollowUp','timeline','signals','sequenceStep'];
function smartMerge(seed,stored){
 const storedById=new Map(stored.map(p=>[p.id,p]));
 const merged=seed.map(seedP=>{
  const out=clone(seedP);
  const local=storedById.get(seedP.id);
  if(local){
   EDITABLE_FIELDS.forEach(f=>{if(local[f]!==undefined)out[f]=local[f]});
   storedById.delete(seedP.id);
  }
  return out;
 });
 // Prospects ajoutés à la main par l'utilisateur (pas dans le fichier source,
 // ex. via "+ Ajouter") : jamais perdus, toujours réinjectés tels quels.
 storedById.forEach(p=>merged.push(p));
 return merged;
}
try{
 const stored=JSON.parse(localStorage.getItem('oligart-clean-data')||'null');
 prospects=Array.isArray(stored)&&stored.length?smartMerge(window.OLIGART_SEED,stored):clone(window.OLIGART_SEED);
}catch{prospects=clone(window.OLIGART_SEED)}
// Migration défensive : les fiches sauvegardées avant l'ajout des nouveaux champs
// (CEO, Head of Sales, timeline, signals...) sont complétées silencieusement,
// sans jamais perdre les données existantes ni bloquer le rendu.
function migrateProspect(p){
 p.ceoName??='';p.ceoLinkedin??='';p.ceoEmail??='';p.headOfSalesName??='';p.headOfSalesLinkedin??='';p.headOfSalesEmail??='';p.phone??='';
 p.contact2Name??='';p.contact2Role??='';p.contact2Email??='';p.contact2Linkedin??='';
 p.category??='Franchises PME';
 if(p.hasAgency===undefined)p.hasAgency=null;
 if(p.likelyNoAgency===undefined)p.likelyNoAgency=false;
 if(!Array.isArray(p.timeline))p.timeline=[];
 if(!Array.isArray(p.signals))p.signals=[];
 if(typeof p.sequenceStep!=='number')p.sequenceStep=0;
 return p;
}
try{prospects=prospects.map(migrateProspect)}catch{/* ne jamais bloquer le chargement */}
function save(){localStorage.setItem('oligart-clean-data',JSON.stringify(prospects));renderAll()}
function addTimelineEntry(p,entry){if(!Array.isArray(p.timeline))p.timeline=[];p.timeline.unshift({date:today(),...entry});save()}
function addSignal(p,signal){if(!Array.isArray(p.signals))p.signals=[];p.signals.unshift({date:today(),...signal});save()}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}
function metric(n,l){return `<div class="metric"><b>${n}</b><span>${l}</span></div>`}
function row(p){return `<div class="row" data-id="${esc(p.id)}"><b>${esc(p.company)}</b><span>${esc(p.sector)}</span><span class="score">${p.score}</span><span class="pill">${esc(p.status)}</span></div>`}
function filtered(){
 const q=($('#search')?.value||'').toLowerCase(), pr=$('#priorityFilter')?.value||'', st=$('#statusFilter')?.value||'', cat=$('#categoryFilter')?.value||'', ag=$('#agencyFilter')?.value||'';
 return prospects.filter(p=>{
  if(q&&!`${p.company} ${p.sector}`.toLowerCase().includes(q))return false;
  if(pr&&p.priority!==pr)return false;
  if(st&&p.status!==st)return false;
  if(cat&&p.category!==cat)return false;
  if(ag==='confirmed'&&p.hasAgency!==false)return false;
  if(ag==='likely'&&!p.likelyNoAgency)return false;
  if(ag==='any'&&!(p.hasAgency===false||p.likelyNoAgency))return false;
  return true;
 });
}
function renderDashboard(){
 $('#heroCount').textContent=prospects.length;
 const contact=prospects.filter(p=>p.status==='Contacté').length, replies=prospects.filter(p=>p.status==='Réponse reçue').length, meetings=prospects.filter(p=>p.status==='RDV pris').length;
 $('#metrics').innerHTML=metric(prospects.length,'prospects')+metric(contact,'contactés')+metric(replies,'réponses')+metric(meetings,'rendez-vous');
 $('#topList').innerHTML=prospects.filter(p=>p.status==='À contacter').sort((a,b)=>b.score-a.score).slice(0,7).map(row).join('');
 const due=prospects.filter(p=>p.nextFollowUp&&p.nextFollowUp<=today()).sort((a,b)=>a.nextFollowUp.localeCompare(b.nextFollowUp)).slice(0,7);
 $('#followList').innerHTML=due.length?due.map(row).join(''):'<p class="muted">Aucune relance échue.</p>';
}
function renderTable(){const list=filtered().sort((a,b)=>b.score-a.score);$('#table').innerHTML=list.length?list.map(row).join(''):'<p class="muted">Aucun résultat.</p>'}
function renderBoard(){
 $('#kanban').innerHTML=BOARD_STATUSES.map(st=>{const list=prospects.filter(p=>p.status===st).sort((a,b)=>b.score-a.score);return `<div class="column" data-status="${esc(st)}"><div class="column-head"><b>${esc(st)}</b><span>${list.length}</span></div>${list.slice(0,60).map(p=>`<div class="card" draggable="true" data-id="${esc(p.id)}"><b>${esc(p.company)}</b><p>${esc(p.sector)} · score ${p.score}</p></div>`).join('')}</div>`}).join('');
 $$('.card').forEach(c=>c.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',c.dataset.id)));
 // Clic sur une carte = ouvre la fiche complète (distinct du drag qui sert
 // à changer le statut) -- le drag natif HTML5 ne déclenche pas de click
 // après un vrai déplacement, donc les deux cohabitent sans conflit.
 $$('.card').forEach(c=>c.addEventListener('click',()=>openProspect(c.dataset.id)));
 $$('.column').forEach(c=>{c.addEventListener('dragover',e=>e.preventDefault());c.addEventListener('drop',e=>{e.preventDefault();const p=prospects.find(x=>x.id===e.dataTransfer.getData('text/plain'));if(p){p.status=c.dataset.status;p.lastContact=today();if(p.status==='Contacté')p.nextFollowUp=today(4);save();toast('Statut mis à jour')}})})
}
function renderToday(){const due=prospects.filter(p=>(p.nextFollowUp&&p.nextFollowUp<=today())||(p.status==='À contacter'&&p.priority==='A')).sort((a,b)=>b.score-a.score);$('#todayList').innerHTML=due.length?due.map(row).join(''):'<p class="muted">Rien d’urgent aujourd’hui.</p>'}
// Hooks optionnels : chaque module additionnel (priorités, outreach, radar,
// carrière, réglages) peut s'enregistrer ici. Une erreur dans l'un d'eux
// n'empêche jamais le cœur de l'app (dashboard/pipeline/board) de fonctionner.
window.__oligartRenderHooks=window.__oligartRenderHooks||[];
function renderAll(){
 renderDashboard();renderTable();renderBoard();renderToday();bindRows();
 window.__oligartRenderHooks.forEach(fn=>{try{fn()}catch(e){console.warn('[oligart] module render failed, core app unaffected:',e)}});
}
function bindRows(){$$('[data-id]').forEach(el=>{if(!el.classList.contains('card'))el.onclick=()=>openProspect(el.dataset.id)})}
function messageFor(p){
 const name=p.contactName?` ${p.contactName}`:'';
 // Positionnement distinct pour les agences media indépendantes : ce ne
 // sont pas des annonceurs (leur pitcher du media buying "Oligart" n'aurait
 // aucun sens, c'est leur propre métier) -- ici Rodolph se positionne en
 // freelance/conseil sur ses domaines d'expertise (biz dev, management
 // commercial, media buying), jamais formulé comme du "go-to-market".
 const AGENCY_CATEGORIES=['Agences Média Indépendantes'];
 if(AGENCY_CATEGORIES.includes(p.category)){
  return `Bonjour${name},\n\nJe me permets de vous contacter au sujet de vos potentiels besoins en conseil pour la rentrée 2026.\n\nAprès 15 ans en direction commerciale dans l'AdTech, le SaaS et les médias, j'accompagne aujourd'hui les agences media indépendantes en freelance/conseil sur le business development et le management commercial.\n\nJe peux notamment mettre à disposition une plateforme AdTech de media buying, donnant accès à de meilleures conditions d'achat media.\n\nJe serais ravi d'échanger 20 minutes pour voir si cela peut avoir du sens pour ${p.company}.\n\nMon site : https://oligart-agency.com\n\nBien à vous,\nRodolph Menten\nrodolph.menten@oligart.fr\n+33 6 88 35 46 76`;
 }
 return `Bonjour${name},\n\nJe me permets de vous contacter au sujet de la stratégie média digitale de ${p.company}.\n\nOligart accompagne les annonceurs à la fois en conseil (structuration de la stratégie média et go-to-market, priorisation des leviers) et en exécution opérationnelle sur l’achat media 360°, branding et performance sur un seul dispositif : display, vidéo, audio, CTV et DOOH pour la notoriété ; native et retargeting pour la conversion.\n\nCe qui fait la différence à l’exécution : un inventaire 100% premium et brand-safe (vérifié par des tiers indépendants type DoubleVerify/IAS), des KPIs garantis contractuellement sur chaque format (CPC, CPM, reach, taux de complétion vidéo), et un ciblage data précis (400+ segments, sans cookies tiers, conforme RGPD).\n\nLe tout géré en direct, avec des honoraires transparents et un format plus flexible qu’une agence traditionnelle — porté par 15 ans en direction commerciale dans l’AdTech, le SaaS et les médias (dont +370% de CA en 2 ans chez Upday).\n\nJe serais ravi d’échanger 20 minutes pour voir comment structurer et optimiser votre stratégie média actuelle.\n\nMon site : https://oligart-agency.com\n\nBien à vous,\nRodolph Menten\nrodolph.menten@oligart.fr\n+33 6 88 35 46 76`;
}
function openProspect(id){selected=prospects.find(p=>p.id===id);if(!selected)return;const p=selected;$('#drawerBody').innerHTML=`<p class="eyebrow">${esc(p.priority)} · SCORE ${p.score}</p><h1>${esc(p.company)}</h1><p class="muted">${esc(p.sector)} · ${esc(p.country)} · ${esc(p.size)}</p><div class="actions"><a class="btn secondary" target="_blank" href="${esc(p.website)}">Site / recherche</a><a class="btn secondary" target="_blank" href="${esc(p.companyLinkedin)}">LinkedIn entreprise</a></div><div class="detail-grid"><label>Statut<select id="dStatus">${STATUSES.map(s=>`<option ${s===p.status?'selected':''}>${s}</option>`).join('')}</select></label><label>Priorité<select id="dPriority">${['A','B','C'].map(s=>`<option ${s===p.priority?'selected':''}>${s}</option>`).join('')}</select></label><label>Prochaine relance<input id="dNext" type="date" value="${esc(p.nextFollowUp)}"></label><label class="wide">Relance rapide<div class="actions" style="margin-top:4px"><button type="button" class="btn secondary" data-followup="3">+3 jours</button><button type="button" class="btn secondary" data-followup="5">+5 jours</button><button type="button" class="btn secondary" data-followup="7">+7 jours</button></div></label><label class="wide">Domaine du site (optionnel, améliore la recherche du contact)<input id="dDomain" placeholder="ex: carglass.fr"></label></div>
 <div class="actions"><button id="findMarketingContact" class="btn secondary">🎯 Trouver le contact marketing / digital (reclique pour un autre)</button><button id="enrichLead" class="btn secondary">🏢 Enrichir l'entreprise (effectif, secteur...)</button></div>
 <p class="muted" id="findContactStatus"></p><div id="enrichResult"></div>
 <div class="detail-grid" style="margin-top:14px"><label class="wide"><b>Contact 1 (décideur média/marketing)</b></label><label>Nom<input id="dName" value="${esc(p.contactName)}" placeholder="Prénom Nom"></label><label>Fonction<input id="dRole" value="${esc(p.targetRole)}" placeholder="Directeur Marketing, Head of Digital..."></label><label>Email<input id="dEmail" type="email" value="${esc(p.contactEmail)}"></label><label>LinkedIn<input id="dLinkedin" value="${esc(p.contactLinkedin)}" placeholder="https://linkedin.com/in/..."></label></div>
 <div class="actions"><button data-contact-action="linkedin-add" class="btn secondary">🔗 Ajouter sur LinkedIn</button><button data-contact-action="email" class="btn secondary">✉️ Envoyer un email</button><button data-contact-action="linkedin-dm" class="btn secondary">💬 DM LinkedIn</button></div>
 <div class="detail-grid" style="margin-top:14px"><label class="wide">Pourquoi Oligart<textarea id="dWhy">${esc(p.why)}</textarea></label><label class="wide">Notes<textarea id="dNotes">${esc(p.notes)}</textarea></label><label class="wide">Message (utilisé pour l'envoi email)<textarea class="message" id="dMessage">${esc(messageFor(p))}</textarea></label></div>
 <div class="actions"><button id="saveDetail" class="btn primary">Enregistrer</button><button id="copyDm" class="btn secondary">Copier le message</button></div>
 <div id="drawerExtra"></div>`;
 $('#drawer').classList.add('open');
 // Relance rapide : +3/+5/+7 jours à partir d'aujourd'hui, directement dans
 // le champ date -- il faut ensuite cliquer Enregistrer comme pour tout
 // autre champ (cohérent avec le reste de la fiche, pas de sauvegarde surprise).
 $$('[data-followup]').forEach(btn=>btn.onclick=()=>{
  const days=parseInt(btn.dataset.followup,10);
  const d=new Date();d.setDate(d.getDate()+days);
  $('#dNext').value=d.toISOString().slice(0,10);
 });
 $('#saveDetail').onclick=()=>{Object.assign(p,{status:$('#dStatus').value,priority:$('#dPriority').value,contactName:$('#dName').value,targetRole:$('#dRole').value,contactEmail:$('#dEmail').value,contactLinkedin:$('#dLinkedin').value,nextFollowUp:$('#dNext').value,why:$('#dWhy').value,notes:$('#dNotes').value});save();toast('Fiche enregistrée')};
 // Recherche du décideur média/marketing/digital. Le premier clic interroge
 // le serveur et met en cache la liste de candidats trouvés (jusqu'à 5) ;
 // les clics suivants font défiler cette liste localement -- sans nouvel
 // appel serveur -- jusqu'à ce que Rodolph trouve le bon contact (ex. un
 // Directeur Communication Corporate ne convient pas même s'il matche
 // vaguement "communication", il doit pouvoir passer au suivant). Contrairement
 // aux autres outils d'enrichissement, ce bouton ÉCRASE volontairement le
 // Contact 1 à chaque clic -- c'est tout l'intérêt du cycle demandé.
 let contactCycle=null;
 $('#findMarketingContact').onclick=async()=>{
  const status=$('#findContactStatus');
  if(!contactCycle){
   status.textContent='Recherche du contact marketing/digital en cours...';
   try{
    const r=await fetch('/.netlify/functions/find-marketing-contacts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company:p.company,domain:$('#dDomain').value.trim(),category:p.category})});
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||'Recherche indisponible');
    if(!data.found||!data.candidates?.length){status.textContent=`Aucun contact marketing/digital trouvé automatiquement (${data.reason||'raison inconnue'}) -- à chercher manuellement.`;return}
    contactCycle={list:data.candidates,index:0};
   }catch(e){
    status.textContent=`Recherche indisponible (${e.message}). Tu peux chercher manuellement.`;
    return;
   }
  }else{
   contactCycle.index=(contactCycle.index+1)%contactCycle.list.length;
  }
  const c=contactCycle.list[contactCycle.index];
  $('#dName').value=c.name;$('#dRole').value=c.role;$('#dEmail').value=c.email||'';$('#dLinkedin').value=c.linkedin||'';
  const looped=contactCycle.index===0&&contactCycle.list.length>1;
  status.textContent=`Candidat ${contactCycle.index+1}/${contactCycle.list.length} : ${c.name} (${c.role}). ${looped?'Retour au premier candidat -- ':''}Pas le bon ? Reclique pour voir le suivant. Pense à cliquer Enregistrer.`;
  toast(`Contact ${contactCycle.index+1}/${contactCycle.list.length}`);
 };
 // Enrichissement gratuit (API officielle Recherche d'Entreprises, INSEE/RNE)
 // -- données sur l'entreprise elle-même (effectif, secteur, siège), pas sur
 // un décideur. Résultat affiché en lecture seule.
 $('#enrichLead').onclick=async()=>{
  const el=$('#enrichResult');
  el.innerHTML='<p class="muted">Recherche dans le registre officiel des entreprises...</p>';
  try{
   const r=await fetch('/.netlify/functions/enrich-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company:p.company})});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||'Enrichissement indisponible');
   if(!d.found){el.innerHTML=`<p class="muted">Non trouvé dans le registre officiel (${esc(d.reason||'raison inconnue')}).</p>`;return}
   el.innerHTML=`<p class="muted">Trouvé : <b>${esc(d.nomOfficiel)}</b> (SIREN ${esc(d.siren)})${d.effectif?'<br>Effectif : '+esc(d.effectif):''}${d.secteur?'<br>Secteur NAF : '+esc(d.secteur):''}${d.siege?'<br>Siège : '+esc(d.siege):''}</p>`;
  }catch(e){
   el.innerHTML=`<p class="muted">Enrichissement indisponible (${esc(e.message)}).</p>`;
  }
 };
 // Actions par contact : LinkedIn (ajout) et DM LinkedIn ouvrent le même
 // profil (impossible d'automatiser un ajout/message LinkedIn sans
 // contourner leurs protections, ce que l'app ne fait jamais) -- le clic
 // Connecter/Message se fait ensuite à la main sur la page LinkedIn. Chaque
 // clic est journalisé dans l'historique du prospect.
 $$('[data-contact-action]').forEach(btn=>btn.onclick=()=>{
  const action=btn.dataset.contactAction;
  const name=$('#dName').value||'ce contact';
  const email=$('#dEmail').value;
  const linkedin=$('#dLinkedin').value;
  if(action==='email'){
   if(!email)return toast('Ajoute un email pour ce contact');
   $('#emailModalTitle').textContent=`Email — ${name} (${p.company})`;
   $('#emTo').value=email;
   $('#emSubject').value=`Échange — ${p.company} x Oligart`;
   $('#emBody').value=$('#dMessage').value;
   $('#emStatus').textContent='';
   $('#emailModal').classList.add('open');
   return;
  }
  if(!linkedin)return toast('Ajoute un lien LinkedIn pour ce contact');
  window.open(linkedin,'_blank');
  const note=action==='linkedin-add'?`Ajout LinkedIn envoyé à ${name}`:`DM LinkedIn envoyé à ${name}`;
  addTimelineEntry(p,{channel:'linkedin',type:'manual',note});
  toast('Action journalisée');
 });
 $('#copyDm').onclick=async()=>{await navigator.clipboard.writeText($('#dMessage').value);toast('Message copié')};
 // Signale aux modules additionnels (outreach, radar, ai) que la fiche est ouverte,
 // pour qu'ils puissent injecter leur contenu dans #drawerExtra sans toucher au coeur.
 try{document.dispatchEvent(new CustomEvent('oligart:prospect-opened',{detail:{id:p.id}}))}catch{/* no-op si CustomEvent indisponible */}
}
$$('[data-close]').forEach(x=>x.onclick=()=>$('#drawer').classList.remove('open'));$$('[data-close-modal]').forEach(x=>x.onclick=()=>$('#modal').classList.remove('open'));
$$('[data-close-email-modal]').forEach(x=>x.onclick=()=>$('#emailModal').classList.remove('open'));
// Historique email complet (section "email_history" du cahier des charges) :
// tout est stocké dans la timeline du prospect en localStorage -- pas de
// Supabase dans ce projet, donc pas de table séparée, mais chaque entrée
// porte tous les champs demandés (destinataire, objet, contenu, statut, date).
$('#emailForm').onsubmit=async(e)=>{
 e.preventDefault();
 const to=$('#emTo').value,subject=$('#emSubject').value,text=$('#emBody').value;
 // Répondre depuis la boîte de réception n'a pas forcément de fiche
 // prospect ouverte (contrairement à un envoi classique depuis une fiche) --
 // on retrouve le prospect correspondant par email si possible, mais
 // l'envoi doit réussir même sans correspondance, jamais un échec silencieux.
 const EMAIL_FIELDS=['contactEmail','ceoEmail','headOfSalesEmail'];
 const p=selected&&selected.contactEmail===to?selected:prospects.find(x=>EMAIL_FIELDS.some(f=>(x[f]||'').toLowerCase()===to.toLowerCase()));
 $('#emStatus').textContent='Envoi en cours...';
 try{
  const r=await fetch('/.netlify/functions/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,subject,text})});
  const d=await r.json();
  if(!r.ok)throw new Error(d.error||'Envoi impossible');
  if(p){p.status='Contacté';p.lastContact=today();p.nextFollowUp=today(4);addTimelineEntry(p,{channel:'email',type:'auto',status:'sent',to,subject,body:text,note:`Email envoyé à ${to} : "${subject}"`})}
  $('#emailModal').classList.remove('open');
  toast('Email envoyé');
  if(p&&$('#drawer').classList.contains('open'))openProspect(p.id);
 }catch(err){
  if(p)addTimelineEntry(p,{channel:'email',type:'auto',status:'failed',to,subject,body:text,note:`Échec d'envoi à ${to} : ${err.message}`});
  $('#emStatus').textContent=`Échec de l'envoi : ${err.message}`;
 }
};
$$('.nav').forEach(n=>n.onclick=()=>{$$('.nav').forEach(x=>x.classList.remove('active'));n.classList.add('active');$$('.view').forEach(x=>x.classList.remove('active'));$('#'+n.dataset.view).classList.add('active');$('#title').textContent=n.textContent});
$$('[data-go]').forEach(b=>b.onclick=()=>document.querySelector(`.nav[data-view="${b.dataset.go}"]`).click());
$('#statusFilter').innerHTML='<option value="">Tous statuts</option>'+STATUSES.map(s=>`<option>${s}</option>`).join('');
// Filtre par catégorie (typologie du fichier source : Franchises PME, Tourisme
// International, Agences Média Indépendantes, Agences Pharma) — options
// construites dynamiquement depuis les catégories réellement présentes.
const CATEGORIES=[...new Set(prospects.map(p=>p.category).filter(Boolean))].sort();
$('#categoryFilter').innerHTML='<option value="">Toutes catégories</option>'+CATEGORIES.map(c=>`<option>${c}</option>`).join('');
// Bug corrigé : après un filtrage (recherche/priorité/statut), il faut ré-attacher
// les clics sur les nouvelles lignes affichées, sinon la fiche ne s'ouvre plus.
function renderTableAndBind(){renderTable();bindRows()}
['search','priorityFilter','statusFilter','categoryFilter','agencyFilter'].forEach(id=>$('#'+id).addEventListener(id==='search'?'input':'change',renderTableAndBind));
$('#addBtn').onclick=()=>$('#modal').classList.add('open');$('#addForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),company=f.get('company');prospects.unshift({id:crypto.randomUUID(),company,sector:f.get('sector')||'',country:'France',model:'B2B',size:'',targetRole:f.get('targetRole')||'CEO / CRO',why:'',priority:f.get('priority')||'A',score:75,status:'À contacter',website:f.get('website')||`https://www.google.com/search?q=${encodeURIComponent(company)}`,companyLinkedin:`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(company)}`,leaderSearch:`https://www.google.com/search?q=${encodeURIComponent(company+' CEO LinkedIn')}`,contactName:'',contactEmail:'',contactLinkedin:'',lastContact:'',nextFollowUp:'',notes:'',jobsUrl:'',jobs:[]});e.target.reset();$('#modal').classList.remove('open');save();toast('Entreprise ajoutée')};
$('#resetBtn').onclick=()=>{if(confirm(`Réinitialisation complète : remet les ${window.OLIGART_SEED.length} prospects à zéro (perd TOUT ton travail : statuts, notes, contacts modifiés, historique). Normalement inutile désormais -- les nouveaux prospects/champs du fichier source se synchronisent automatiquement sans perdre tes données. À utiliser seulement en dernier recours. Continuer ?`)){prospects=clone(window.OLIGART_SEED);save();toast('Base réinitialisée')}};
$('#exportBtn').onclick=()=>{const cols=['company','sector','priority','score','status','contactName','contactEmail','contactLinkedin','nextFollowUp','notes'];const csv=[cols.join(','),...prospects.map(p=>cols.map(k=>'"'+String(p[k]||'').replaceAll('"','""')+'"').join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='oligart-prospects.csv';a.click();URL.revokeObjectURL(a.href)};
renderAll();

// API interne partagée avec les modules additionnels (priorities.js, outreach.js,
// radar.js, career.js, ai.js, settings.js). Volontairement minimale et stable :
// ces modules ne touchent jamais directement au tableau `prospects` pour éviter
// toute désynchronisation avec le rendu ou la sauvegarde locale.
window.Oligart={
 getProspects:()=>prospects,
 getProspect:id=>prospects.find(p=>p.id===id),
 save,
 esc,
 today,
 toast,
 metric,
 STATUSES,
 messageFor,
 addTimelineEntry,
 addSignal,
 openProspect,
 registerRenderHook:fn=>{if(typeof fn==='function')window.__oligartRenderHooks.push(fn)}
};
})();
