(()=>{
'use strict';
// Vue Emails : "Envoyés" agrège les entrées timeline (channel:email) de
// TOUS les prospects en une seule liste chronologique (déjà stockées en
// localStorage, rien à récupérer) ; "Boîte de réception" appelle
// fetch-inbox.js (IMAP réel sur la boîte Gandi, mêmes identifiants que
// l'envoi SMTP). Onglets simples, pas de nouvelle dépendance de rendu.

function renderSent(){
 const el=document.querySelector('#emailsSentView');
 if(!el||!window.Oligart)return;
 const {getProspects,esc,openProspect}=window.Oligart;
 const rows=[];
 getProspects().forEach(p=>(p.timeline||[]).forEach(t=>{
  if(t.channel==='email')rows.push({...t,company:p.company,id:p.id});
 }));
 rows.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
 if(!rows.length){el.innerHTML='<p class="muted">Aucun email envoyé pour l’instant depuis le CRM.</p>';return}
 el.innerHTML=rows.map(r=>`<div class="row row-5" data-id="${esc(r.id)}"><b>${esc(r.company)}</b><span>${esc(r.to||'')}</span><span>${esc(r.subject||r.note||'')}</span><span class="pill">${r.status==='failed'?'Échec':'Envoyé'}</span><span class="muted">${esc(r.date||'')}</span></div>`).join('');
 el.querySelectorAll('[data-id]').forEach(row=>row.onclick=()=>openProspect(row.dataset.id));
}

async function renderInbox(){
 const el=document.querySelector('#emailsInboxView');
 if(!el)return;
 el.innerHTML='<p class="muted">Chargement de la boîte de réception...</p>';
 try{
  const r=await fetch('/.netlify/functions/fetch-inbox');
  const data=await r.json();
  if(!r.ok)throw new Error(data.error||'Boîte de réception indisponible');
  if(!data.messages.length){el.innerHTML='<p class="muted">Boîte de réception vide.</p>';return}
  const esc=window.Oligart?.esc||(s=>s);
  el.innerHTML=data.messages.map(m=>`<div class="row" data-uid="${m.uid}" style="cursor:pointer"><b${m.unread?' style="color:#fff"':''}>${esc(m.fromName||m.from)}</b><span>${esc(m.from)}</span><span>${esc(m.subject)}</span><span class="muted">${m.date?new Date(m.date).toLocaleString('fr-FR'):''}</span></div>`).join('');
  // Clic : ouvre le contenu réel du message (pas juste la liste) via
  // fetch-inbox.js?uid=X, affiché dans un modal dédié en lecture.
  el.querySelectorAll('[data-uid]').forEach(row=>row.onclick=()=>openEmailMessage(row.dataset.uid));
 }catch(e){
  el.innerHTML=`<p class="muted">Boîte de réception indisponible (${e.message}). Vérifie SMTP_USER/SMTP_PASS sur Netlify.</p>`;
 }
}

// Signature standard, ajoutée automatiquement au bas de chaque réponse.
const SIGNATURE = "\n\nRodolph Menten\nOligart Agency\nrodolph.menten@oligart.fr\n+33688354676";

async function openEmailMessage(uid){
 const esc=window.Oligart?.esc||(s=>s);
 const modal=document.querySelector('#emailViewModal');
 document.querySelector('#emailViewSubject').textContent='Chargement...';
 document.querySelector('#emailViewMeta').textContent='';
 document.querySelector('#emailViewBody').textContent='';
 document.querySelector('#emailViewProspectBtn').style.display='none';
 modal.classList.add('open');
 try{
  const r=await fetch(`/.netlify/functions/fetch-inbox?uid=${encodeURIComponent(uid)}`);
  const data=await r.json();
  if(!r.ok)throw new Error(data.error||'Message indisponible');
  const m=data.message;
  document.querySelector('#emailViewSubject').textContent=m.subject;
  document.querySelector('#emailViewMeta').textContent=`De : ${m.from} — ${m.date?new Date(m.date).toLocaleString('fr-FR'):''}`;
  document.querySelector('#emailViewBody').textContent=m.text||'(pas de contenu texte disponible)';

  // Répondre : ouvre le modal d'envoi existant, pré-rempli (destinataire,
  // "Re: objet", corps vide + signature) -- comme une vraie boîte mail.
  document.querySelector('#emailViewReplyBtn').onclick=()=>{
   modal.classList.remove('open');
   const fromEmail=(m.from.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)||[])[0]||m.from;
   document.querySelector('#emailModalTitle').textContent=`Répondre — ${fromEmail}`;
   document.querySelector('#emTo').value=fromEmail;
   document.querySelector('#emSubject').value=/^re\s*:/i.test(m.subject)?m.subject:`Re: ${m.subject}`;
   document.querySelector('#emBody').value=SIGNATURE.trim()+"\n\n";
   document.querySelector('#emStatus').textContent='';
   document.querySelector('#emailModal').classList.add('open');
   // Curseur en haut du champ, prêt à écrire la réponse au-dessus de la
   // signature déjà en place.
   const body=document.querySelector('#emBody');
   body.focus();body.setSelectionRange(0,0);
  };

  // Si l'expéditeur correspond à un contact connu (contact 1/2, CEO, Head
  // of Sales), un bouton permet d'ouvrir directement sa fiche.
  const fromEmailMatch=(m.from.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)||[])[0]?.toLowerCase();
  const EMAIL_FIELDS=['contactEmail','contact2Email','ceoEmail','headOfSalesEmail'];
  const match=fromEmailMatch&&window.Oligart?.getProspects().find(p=>EMAIL_FIELDS.some(f=>(p[f]||'').toLowerCase()===fromEmailMatch));
  if(match){
   const btn=document.querySelector('#emailViewProspectBtn');
   btn.style.display='';
   btn.textContent=`Voir la fiche ${match.company}`;
   btn.onclick=()=>{modal.classList.remove('open');window.Oligart.openProspect(match.id)};
  }
 }catch(e){
  document.querySelector('#emailViewSubject').textContent='Erreur';
  document.querySelector('#emailViewBody').textContent=`Impossible de charger ce message (${e.message}).`;
 }
}

function initTabs(){
 const btnSent=document.querySelector('#emailTabSent'), btnInbox=document.querySelector('#emailTabInbox');
 const viewSent=document.querySelector('#emailsSentView'), viewInbox=document.querySelector('#emailsInboxView');
 if(!btnSent||!btnInbox)return;
 function setActive(sent){
  btnSent.classList.toggle('primary',sent);btnSent.classList.toggle('secondary',!sent);
  btnInbox.classList.toggle('primary',!sent);btnInbox.classList.toggle('secondary',sent);
 }
 btnSent.onclick=()=>{viewSent.style.display='';viewInbox.style.display='none';setActive(true);renderSent()};
 btnInbox.onclick=()=>{viewSent.style.display='none';viewInbox.style.display='';setActive(false);renderInbox()};
 setActive(true);
 document.querySelector('#refreshInbox').onclick=()=>{renderSent();if(viewInbox.style.display!=='none')renderInbox()};
}

function init(){
 initTabs();
 document.querySelectorAll('[data-close-emailview-modal]').forEach(x=>x.onclick=()=>document.querySelector('#emailViewModal').classList.remove('open'));
 if(window.Oligart)window.Oligart.registerRenderHook(renderSent);
 renderSent();
}
init();
})();
