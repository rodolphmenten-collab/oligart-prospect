(()=>{
'use strict';
const VERSION='clean-2026-08-06-v1';
const STATUSES=['À contacter','Contacté','Réponse reçue','RDV pris','Proposition envoyée','Gagné','À relancer','Perdu'];
const BOARD_STATUSES=['À contacter','Contacté','Réponse reçue','RDV pris','Proposition envoyée'];
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clone=o=>JSON.parse(JSON.stringify(o));
const today=(n=0)=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
let prospects=[]; let selected=null;
try{const stored=JSON.parse(localStorage.getItem('oligart-clean-data')||'null'); prospects=Array.isArray(stored)&&stored.length?stored:clone(window.OLIGART_SEED)}catch{prospects=clone(window.OLIGART_SEED)}
// Migration défensive : les fiches sauvegardées avant l'ajout des nouveaux champs
// (CEO, Head of Sales, timeline, signals...) sont complétées silencieusement,
// sans jamais perdre les données existantes ni bloquer le rendu.
function migrateProspect(p){
 p.ceoName??='';p.ceoLinkedin??='';p.headOfSalesName??='';p.headOfSalesLinkedin??='';p.headOfSalesEmail??='';p.phone??='';
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
function filtered(){const q=($('#search')?.value||'').toLowerCase(), pr=$('#priorityFilter')?.value||'', st=$('#statusFilter')?.value||'';return prospects.filter(p=>(!q||`${p.company} ${p.sector}`.toLowerCase().includes(q))&&(!pr||p.priority===pr)&&(!st||p.status===st))}
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
function messageFor(p){const name=p.contactName?` ${p.contactName}`:'';return `Bonjour${name},\n\nJe me permets de vous contacter car ${p.company} est à un stade où la structuration commerciale, le marketing et l’acquisition peuvent devenir un véritable accélérateur.\n\nJ’accompagne, via Oligart, des entreprises en croissance sur leur go-to-market, l’organisation commerciale, les partenariats et le media buying, avec un format très opérationnel et flexible.\n\nJe serais ravi d’échanger 20 minutes pour voir si mon expérience peut être utile à vos priorités actuelles.\n\nMon site : https://oligart-agency.com\n\nBien à vous,\nRodolph Menten`}
function openProspect(id){selected=prospects.find(p=>p.id===id);if(!selected)return;const p=selected;$('#drawerBody').innerHTML=`<p class="eyebrow">${esc(p.priority)} · SCORE ${p.score}</p><h1>${esc(p.company)}</h1><p class="muted">${esc(p.sector)} · ${esc(p.country)} · ${esc(p.size)}</p><div class="actions"><a class="btn secondary" target="_blank" href="${esc(p.website)}">Site / recherche</a><a class="btn secondary" target="_blank" href="${esc(p.companyLinkedin)}">LinkedIn entreprise</a><a class="btn secondary" target="_blank" href="${esc(p.contactLinkedin||p.leaderSearch)}">Décideur LinkedIn</a></div><div class="detail-grid"><label>Statut<select id="dStatus">${STATUSES.map(s=>`<option ${s===p.status?'selected':''}>${s}</option>`).join('')}</select></label><label>Priorité<select id="dPriority">${['A','B','C'].map(s=>`<option ${s===p.priority?'selected':''}>${s}</option>`).join('')}</select></label><label>Nom du contact<input id="dName" value="${esc(p.contactName)}"></label><label>Fonction cible<input id="dRole" value="${esc(p.targetRole)}"></label><label>Email<input id="dEmail" type="email" value="${esc(p.contactEmail)}"></label><label>LinkedIn du contact<input id="dLinkedin" value="${esc(p.contactLinkedin)}"></label><label>Prochaine relance<input id="dNext" type="date" value="${esc(p.nextFollowUp)}"></label><label class="wide">Pourquoi Oligart<textarea id="dWhy">${esc(p.why)}</textarea></label><label class="wide">Notes<textarea id="dNotes">${esc(p.notes)}</textarea></label><label class="wide">Message<textarea class="message" id="dMessage">${esc(messageFor(p))}</textarea></label></div><div class="actions"><button id="saveDetail" class="btn primary">Enregistrer</button><button id="copyDm" class="btn secondary">Copier le message</button><button id="openMail" class="btn secondary">Ouvrir dans Airmail</button><button id="sendMail" class="btn secondary">Envoyer via Gandi</button></div>`;
 $('#drawer').classList.add('open');
 $('#saveDetail').onclick=()=>{Object.assign(p,{status:$('#dStatus').value,priority:$('#dPriority').value,contactName:$('#dName').value,targetRole:$('#dRole').value,contactEmail:$('#dEmail').value,contactLinkedin:$('#dLinkedin').value,nextFollowUp:$('#dNext').value,why:$('#dWhy').value,notes:$('#dNotes').value});save();toast('Fiche enregistrée')};
 $('#copyDm').onclick=async()=>{await navigator.clipboard.writeText($('#dMessage').value);toast('Message copié')};
 $('#openMail').onclick=()=>{if(!$('#dEmail').value)return toast('Ajoute un email');location.href=`mailto:${encodeURIComponent($('#dEmail').value)}?subject=${encodeURIComponent('Échange — '+p.company+' x Oligart')}&body=${encodeURIComponent($('#dMessage').value)}`};
 $('#sendMail').onclick=async()=>{if(!$('#dEmail').value)return toast('Ajoute un email');try{const r=await fetch('/.netlify/functions/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:$('#dEmail').value,subject:'Échange — '+p.company+' x Oligart',text:$('#dMessage').value})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Envoi impossible');p.status='Contacté';p.lastContact=today();p.nextFollowUp=today(4);save();toast('Email envoyé')}catch(e){toast(e.message)}}
}
$$('[data-close]').forEach(x=>x.onclick=()=>$('#drawer').classList.remove('open'));$$('[data-close-modal]').forEach(x=>x.onclick=()=>$('#modal').classList.remove('open'));
$$('.nav').forEach(n=>n.onclick=()=>{$$('.nav').forEach(x=>x.classList.remove('active'));n.classList.add('active');$$('.view').forEach(x=>x.classList.remove('active'));$('#'+n.dataset.view).classList.add('active');$('#title').textContent=n.textContent});
$$('[data-go]').forEach(b=>b.onclick=()=>document.querySelector(`.nav[data-view="${b.dataset.go}"]`).click());
$('#statusFilter').innerHTML='<option value="">Tous statuts</option>'+STATUSES.map(s=>`<option>${s}</option>`).join('');['search','priorityFilter','statusFilter'].forEach(id=>$('#'+id).addEventListener(id==='search'?'input':'change',renderTable));
$('#addBtn').onclick=()=>$('#modal').classList.add('open');$('#addForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),company=f.get('company');prospects.unshift({id:crypto.randomUUID(),company,sector:f.get('sector')||'',country:'France',model:'B2B',size:'',targetRole:f.get('targetRole')||'CEO / CRO',why:'',priority:f.get('priority')||'A',score:75,status:'À contacter',website:f.get('website')||`https://www.google.com/search?q=${encodeURIComponent(company)}`,companyLinkedin:`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(company)}`,leaderSearch:`https://www.google.com/search?q=${encodeURIComponent(company+' CEO LinkedIn')}`,contactName:'',contactEmail:'',contactLinkedin:'',lastContact:'',nextFollowUp:'',notes:'',jobsUrl:'',jobs:[]});e.target.reset();$('#modal').classList.remove('open');save();toast('Entreprise ajoutée')};
$('#resetBtn').onclick=()=>{if(confirm('Restaurer les 200 prospects de départ ?')){prospects=clone(window.OLIGART_SEED);save();toast('Base restaurée')}};
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
 STATUSES,
 messageFor,
 addTimelineEntry,
 addSignal,
 registerRenderHook:fn=>{if(typeof fn==='function')window.__oligartRenderHooks.push(fn)}
};
})();
