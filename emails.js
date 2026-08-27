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
  el.innerHTML=data.messages.map((m,i)=>`<div class="row" data-idx="${i}" style="cursor:pointer"><b${m.unread?' style="color:#fff"':''}>${esc(m.fromName||m.from)}</b><span>${esc(m.from)}</span><span>${esc(m.subject)}</span><span class="muted">${m.date?new Date(m.date).toLocaleString('fr-FR'):''}</span></div>`).join('');
  // Clic : cherche un prospect dont un des champs email correspond à
  // l'expéditeur (contact 1/2, CEO, Head of Sales) et ouvre sa fiche.
  // Si aucun ne correspond, message clair plutôt qu'un clic silencieux.
  el.querySelectorAll('[data-idx]').forEach(row=>row.onclick=()=>{
   const msg=data.messages[row.dataset.idx];
   const fromEmail=(msg.from||'').toLowerCase();
   if(!fromEmail){window.Oligart?.toast('Adresse expéditeur inconnue');return}
   const EMAIL_FIELDS=['contactEmail','contact2Email','ceoEmail','headOfSalesEmail'];
   const match=window.Oligart?.getProspects().find(p=>EMAIL_FIELDS.some(f=>(p[f]||'').toLowerCase()===fromEmail));
   if(match){window.Oligart.openProspect(match.id)}
   else window.Oligart?.toast(`Aucun prospect trouvé pour ${msg.from}`);
  });
 }catch(e){
  el.innerHTML=`<p class="muted">Boîte de réception indisponible (${e.message}). Vérifie SMTP_USER/SMTP_PASS sur Netlify.</p>`;
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
 if(window.Oligart)window.Oligart.registerRenderHook(renderSent);
 renderSent();
}
init();
})();
