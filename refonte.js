(()=>{
'use strict';
// Module additionnel : campagne "Offre Refonte & Pack Trafic".
//
// Isolation volontaire :
//  - toutes les données de la campagne vivent dans un sous-objet `p.refonte`,
//    jamais dans les champs existants. Le pipeline principal (statut,
//    nextFollowUp...) n'est jamais touché, les deux campagnes coexistent sur
//    la même fiche sans se marcher dessus ;
//  - le module s'enregistre via registerRenderHook, donc une erreur ici est
//    attrapée par renderAll() et n'empêche pas le reste de l'app de tourner ;
//  - aucun style n'est ajouté à styles.css, tout est injecté ici.

const ST={
 AUDIT:'À auditer', QUALIF:'Qualifié', REVOIR:'À revoir', REJET:'Rejeté', SANSSITE:'Sans site',
 MAQ:'Maquette prête', VALID:'Validé Rodolph', ENVOYE:'Mail envoyé', RELANCE:'Relancé',
 REPONSE:'Réponse', SIGNE:'Signé', PROD:'En production', LIVRE:'Livré', CLOS:'Clos sans réponse'
};
const ORDER=[ST.AUDIT,ST.QUALIF,ST.REVOIR,ST.REJET,ST.SANSSITE,ST.MAQ,ST.VALID,ST.ENVOYE,ST.RELANCE,ST.REPONSE,ST.SIGNE,ST.PROD,ST.LIVRE,ST.CLOS];
const COLOR={
 [ST.AUDIT]:'#64748b',[ST.QUALIF]:'#0ea5e9',[ST.REVOIR]:'#f59e0b',[ST.REJET]:'#475569',[ST.SANSSITE]:'#db2777',
 [ST.MAQ]:'#8b5cf6',[ST.VALID]:'#6366f1',[ST.ENVOYE]:'#0891b2',[ST.RELANCE]:'#0e7490',
 [ST.REPONSE]:'#16a34a',[ST.SIGNE]:'#15803d',[ST.PROD]:'#ca8a04',[ST.LIVRE]:'#065f46',[ST.CLOS]:'#374151'
};
const PACK={P500:{label:'Pack Site',prix:500},P3500:{label:'Pack Site + Trafic',prix:3500}};

let sortKey='total', sortDir=-1, filterStatus='', filterQuery='';

// --- utilitaires ----------------------------------------------------------
const E=v=>window.Oligart.esc(v==null?'':v);
function R(p){ return p.refonte||null; }
function ensure(p){ if(!p.refonte)p.refonte={status:ST.AUDIT,historique:[]}; if(!Array.isArray(p.refonte.historique))p.refonte.historique=[]; return p.refonte; }
function total(r){ return (Number(r&&r.besoin&&r.besoin.total)||0)+(Number(r&&r.capacite&&r.capacite.total)||0); }
function joursOuvres(dateISO,n){
 const d=dateISO?new Date(dateISO+'T12:00:00'):new Date();
 let reste=n;
 while(reste>0){ d.setDate(d.getDate()+1); const j=d.getDay(); if(j!==0&&j!==6)reste--; }
 return d.toISOString().slice(0,10);
}
function campagne(){ return window.Oligart.getProspects().filter(p=>p.refonte); }
function log(p,texte){ ensure(p).historique.unshift({date:window.Oligart.today(),texte}); }

// --- styles ---------------------------------------------------------------
function styles(){
 if(document.getElementById('refonteStyles'))return;
 const s=document.createElement('style'); s.id='refonteStyles';
 s.textContent=`
 #refonte .rf-badge{display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:600;color:#fff;white-space:nowrap}
 #refonte table{width:100%;border-collapse:collapse;font-size:14px}
 #refonte th{text-align:left;padding:9px 8px;border-bottom:1px solid var(--line,#26303f);cursor:pointer;user-select:none;white-space:nowrap;color:#93a1b5;font-weight:600}
 #refonte th:hover{color:#e8edf5}
 #refonte td{padding:9px 8px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:middle}
 #refonte tbody tr:hover{background:rgba(255,255,255,.03)}
 #refonte .rf-vignette{width:64px;height:40px;object-fit:cover;object-position:top;border-radius:4px;border:1px solid rgba(255,255,255,.12)}
 #refonte .rf-num{font-variant-numeric:tabular-nums;text-align:right}
 #refonte .rf-mini{padding:4px 10px;font-size:13px}
 #refonte .rf-scroll{overflow-x:auto}
 #refonte .rf-empty{padding:28px;text-align:center}
 .rf-modal{position:fixed;inset:0;z-index:99990;display:none;align-items:center;justify-content:center;background:rgba(9,12,18,.9)}
 .rf-modal.open{display:flex}
 .rf-modal-card{width:min(760px,94vw);max-height:90vh;overflow:auto;background:#141a24;border:1px solid #263141;border-radius:14px;padding:26px;color:#e8edf5}
 .rf-modal-card textarea{width:100%;box-sizing:border-box;min-height:300px;font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;background:#0d131c;color:#e8edf5;border:1px solid #2c3950;border-radius:9px;padding:12px}
 .rf-modal-card input{width:100%;box-sizing:border-box;background:#0d131c;color:#e8edf5;border:1px solid #2c3950;border-radius:9px;padding:10px 12px;margin-bottom:10px}
 .rf-shots{display:flex;gap:14px;flex-wrap:wrap;margin:12px 0}
 .rf-shots img{max-width:260px;border-radius:8px;border:1px solid rgba(255,255,255,.14)}
 .rf-probs li{margin-bottom:7px}
 /* Aperçu : on rend le mail tel qu'il arrivera chez le prospect — fond clair,
    police de messagerie, liens cliquables et vignette de la maquette. */
 #rfPreview{background:#fff;color:#1a1a1a;border-radius:10px;padding:20px;font:15px/1.6 -apple-system,'Segoe UI',Roboto,sans-serif;max-height:340px;overflow:auto}
 #rfPreview .rf-pv-obj{font-weight:700;font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:10px;margin-bottom:12px;color:#111}
 #rfPreview .rf-pv-de{color:#6b7280;font-size:13px;margin-bottom:12px}
 #rfPreview a{color:#1d4ed8}
 #rfPreview .rf-pv-shot{margin-top:14px}
 #rfPreview .rf-pv-shot img{max-width:190px;border:1px solid #e5e7eb;border-radius:8px}
 #rfPreview .rf-pv-vide{color:#9ca3af;font-style:italic}
 `;
 document.head.appendChild(s);
}

// --- tableau de bord ------------------------------------------------------
function renderDash(el,list){
 const n=st=>list.filter(p=>R(p).status===st).length;
 const audites=list.filter(p=>R(p).status!==ST.AUDIT).length;
 const qualifies=list.filter(p=>![ST.AUDIT,ST.REJET,ST.REVOIR,ST.SANSSITE].includes(R(p).status)).length;
 const envoyes=list.filter(p=>[ST.ENVOYE,ST.RELANCE,ST.REPONSE,ST.SIGNE,ST.PROD,ST.LIVRE,ST.CLOS].includes(R(p).status)).length;
 const reponses=list.filter(p=>[ST.REPONSE,ST.SIGNE,ST.PROD,ST.LIVRE].includes(R(p).status)).length;
 const signes=list.filter(p=>[ST.SIGNE,ST.PROD,ST.LIVRE].includes(R(p).status));
 const livres=list.filter(p=>R(p).status===ST.LIVRE);
 const ca=arr=>arr.reduce((s,p)=>s+(R(p).pack==='P3500'?3500:500),0);
 // CA encaissé : 50% d'acompte à la signature, solde à la livraison.
 const encaisse=signes.reduce((s,p)=>{const prix=R(p).pack==='P3500'?3500:500;return s+(R(p).status===ST.LIVRE?prix:prix/2)},0);
 const pct=(a,b)=>b?Math.round(a/b*100)+'%':'—';
 const m=(v,l)=>`<div class="metric"><b>${v}</b><span>${l}</span></div>`;
 el.innerHTML=[
  m(audites,'audités'), m(n(ST.QUALIF),'qualifiés'), m(n(ST.MAQ),'maquettes prêtes'),
  m(n(ST.VALID),'validés'), m(envoyes,'mails envoyés'), m(reponses,'réponses'),
  m(signes.length,'signés'), m(livres.length,'livrés'),
  m(pct(qualifies,audites),'taux de qualification'),
  m(pct(reponses,envoyes),'taux de réponse'),
  m(ca(signes).toLocaleString('fr-FR')+' €','CA signé (HT)'),
  m(Math.round(encaisse).toLocaleString('fr-FR')+' €','CA encaissé (HT)')
 ].join('');
}

// --- tableau --------------------------------------------------------------
function ligne(p){
 const r=R(p), t=total(r);
 const maq=r.maquetteUrl
  ? `<a href="${E(r.maquetteUrl)}" target="_blank" rel="noopener">${r.shotDesktop?`<img class="rf-vignette" src="${E(r.shotDesktop)}" alt="Maquette ${E(p.company)}">`:'voir'}</a>`
  : '<span class="muted">—</span>';
 const peutValider=r.status===ST.MAQ;
 const peutEnvoyer=r.status===ST.VALID;
 const peutRelancer=r.status===ST.ENVOYE&&r.relanceAt&&r.relanceAt<=window.Oligart.today();
 return `<tr data-rf="${E(p.id)}">
  <td><b>${E(p.company)}</b></td>
  <td class="muted">${E(p.sector)}</td>
  <td class="muted">${E(r.ville)}</td>
  <td class="rf-num">${r.besoin?r.besoin.total:'—'}</td>
  <td class="rf-num">${r.capacite?r.capacite.total:'—'}</td>
  <td class="rf-num"><b>${t||'—'}</b></td>
  <td><span class="rf-badge" style="background:${COLOR[r.status]||'#475569'}">${E(r.status)}</span></td>
  <td>${r.pack?E(PACK[r.pack].label)+' · '+PACK[r.pack].prix+' €':'<span class="muted">—</span>'}</td>
  <td>${maq}</td>
  <td class="muted">${E(r.sentAt)||'—'}</td>
  <td class="muted">${E(r.relanceAt)||'—'}</td>
  <td class="muted">${E(r.prochaineAction)||'—'}</td>
  <td style="white-space:nowrap">
   <button class="btn secondary rf-mini" data-rf-open="${E(p.id)}">Voir</button>
   ${peutValider?`<button class="btn primary rf-mini" data-rf-valid="${E(p.id)}">Valider</button>`:''}
   ${peutEnvoyer?`<button class="btn primary rf-mini" data-rf-msg="${E(p.id)}">Message</button>`:''}
   ${peutRelancer?`<button class="btn primary rf-mini" data-rf-rel="${E(p.id)}">Relance</button>`:''}
  </td></tr>`;
}
function renderTable(el,list){
 const q=filterQuery.toLowerCase();
 let rows=list.filter(p=>{
  if(filterStatus&&R(p).status!==filterStatus)return false;
  if(!q)return true;
  return [p.company,p.sector,R(p).ville].some(v=>(v||'').toLowerCase().includes(q));
 });
 const val=p=>({company:(p.company||'').toLowerCase(),besoin:R(p).besoin?R(p).besoin.total:-1,
  capacite:R(p).capacite?R(p).capacite.total:-1,total:total(R(p)),
  statut:ORDER.indexOf(R(p).status),sent:R(p).sentAt||''}[sortKey]);
 rows.sort((a,b)=>{const x=val(a),y=val(b);return (x>y?1:x<y?-1:0)*sortDir});
 const th=(k,l,extra='')=>`<th data-rf-sort="${k}"${extra}>${l}${sortKey===k?(sortDir>0?' ▲':' ▼'):''}</th>`;
 el.innerHTML=rows.length?`<div class="rf-scroll"><table>
  <thead><tr>${th('company','Entreprise')}<th>Secteur</th><th>Ville</th>
  ${th('besoin','Besoin')}${th('capacite','Capacité')}${th('total','Total')}${th('statut','Statut')}
  <th>Pack</th><th>Maquette</th>${th('sent','Envoyé')}<th>Relance</th><th>Prochaine action</th><th></th></tr></thead>
  <tbody>${rows.map(ligne).join('')}</tbody></table></div>`
  :'<p class="muted rf-empty">Aucun prospect dans cette campagne pour ce filtre.</p>';
}

// --- fiche détaillée ------------------------------------------------------
function fiche(id){
 const p=window.Oligart.getProspect(id); if(!p||!p.refonte)return;
 const r=R(p);
 const d=(o,k)=>o&&o[k]!=null?o[k]:'—';
 const body=`<p class="eyebrow">CAMPAGNE REFONTE · ${E(r.status)}</p><h1>${E(p.company)}</h1>
 <p class="muted">${E(p.sector)}${r.ville?' · '+E(r.ville):''}${p.website?' · <a href="'+E(p.website)+'" target="_blank" rel="noopener">site actuel</a>':''}</p>
 <div class="metrics" style="grid-template-columns:repeat(3,1fr)">
  <div class="metric"><b>${r.besoin?r.besoin.total:'—'}</b><span>besoin /50</span></div>
  <div class="metric"><b>${r.capacite?r.capacite.total:'—'}</b><span>capacité /50</span></div>
  <div class="metric"><b>${total(r)||'—'}</b><span>total /100</span></div>
 </div>
 <h3 style="margin-top:18px">Audit</h3>
 <div class="detail-grid">
  <label>Mobile<input value="${d(r.besoin,'mobile')}" readonly></label>
  <label>Vitesse<input value="${d(r.besoin,'vitesse')}" readonly></label>
  <label>Design<input value="${d(r.besoin,'design')}" readonly></label>
  <label>Conversion<input value="${d(r.besoin,'conversion')}" readonly></label>
  <label>Bases<input value="${d(r.besoin,'bases')}" readonly></label>
  <label>Avis Google<input value="${d(r.capacite,'avis')}" readonly></label>
  <label>Réseaux sociaux<input value="${d(r.capacite,'social')}" readonly></label>
  <label>Point de vente<input value="${d(r.capacite,'pdv')}" readonly></label>
  <label>Taille<input value="${d(r.capacite,'taille')}" readonly></label>
  <label>Panier secteur<input value="${d(r.capacite,'panier')}" readonly></label>
 </div>
 <h3 style="margin-top:18px">Les 3 problèmes chiffrés</h3>
 <ul class="rf-probs">${(r.problemes||[]).map(x=>`<li>${E(x)}</li>`).join('')||'<li class="muted">non trouvé</li>'}</ul>
 <h3 style="margin-top:18px">Éléments de marque</h3>
 <div class="detail-grid">
  <label class="wide">Logo<input value="${E(r.marque&&r.marque.logo)||'non trouvé'}" readonly></label>
  <label>Couleurs<input value="${E((r.marque&&r.marque.couleurs||[]).join(', '))||'non trouvé'}" readonly></label>
  <label>Ton<input value="${E(r.marque&&r.marque.ton)||'non trouvé'}" readonly></label>
  <label class="wide">Produits / services phares<input value="${E((r.marque&&r.marque.produits||[]).join(' · '))||'non trouvé'}" readonly></label>
  <label class="wide">Accroches du site<textarea readonly>${E((r.marque&&r.marque.accroches||[]).join('\n'))}</textarea></label>
 </div>
 <h3 style="margin-top:18px">Maquette</h3>
 ${r.maquetteUrl?`<p><a class="btn secondary" href="${E(r.maquetteUrl)}" target="_blank" rel="noopener">Ouvrir la maquette</a>
   ${r.diagnosticUrl?`<a class="btn secondary" href="${E(r.diagnosticUrl)}" target="_blank" rel="noopener">Ouvrir le diagnostic</a>`:''}</p>
  <div class="rf-shots">${r.shotMobile?`<img src="${E(r.shotMobile)}" alt="Aperçu mobile">`:''}${r.shotDesktop?`<img src="${E(r.shotDesktop)}" alt="Aperçu desktop">`:''}</div>`
  :'<p class="muted">Pas encore de maquette.</p>'}
 <h3 style="margin-top:18px">Pack suggéré</h3>
 <p>${r.pack?`<b>${E(PACK[r.pack].label)} — ${PACK[r.pack].prix} € HT.</b> ${E(r.packJustif)}`:'<span class="muted">non défini</span>'}</p>
 <h3 style="margin-top:18px">Historique</h3>
 <div>${(r.historique||[]).map(h=>`<div class="row"><b>${E(h.date)}</b><span>${E(h.texte)}</span></div>`).join('')||'<p class="muted">Aucun échange.</p>'}</div>
 <div class="actions" style="margin-top:18px">
  ${r.status===ST.MAQ?`<button class="btn primary" data-rf-valid="${E(p.id)}">Valider la maquette</button>`:''}
  ${r.status===ST.VALID?`<button class="btn primary" data-rf-msg="${E(p.id)}">Préparer le message</button>`:''}
 </div>`;
 document.querySelector('#drawerBody').innerHTML=body;
 document.querySelector('#drawer').classList.add('open');
}

// --- composition du message (rôle BDR) ------------------------------------
function brouillon(p,relance){
 const r=R(p), pr=r.problemes||[];
 const prenom=p.contactName?' '+p.contactName.split(' ')[0]:'';
 if(relance){
  return {
   objet:`Re: ${r.dernierObjet||'Votre site sur mobile, '+p.company}`,
   corps:`Bonjour${prenom},\n\nJe reviens une seule fois vers vous.\n\n${pr[2]||pr[0]||''}\n\nLa maquette reste en ligne si vous voulez y jeter un œil : ${r.maquetteUrl||''}\n\nSi ce n'est pas le sujet, répondez simplement "non" et je ne vous recontacterai pas.\n\nRodolph Menten\nOligart Agency\n+33 6 88 35 46 76\noligart-agency.com`
  };
 }
 const accroche=(r.marque&&r.marque.accroches&&r.marque.accroches[0])?r.marque.accroches[0]:'';
 const ouverture=accroche
  ? `J'ai regardé votre site — ${accroche.toLowerCase().replace(/\.$/,'')}.`
  : `J'ai regardé le site de ${p.company}.`;
 return {
  objet:`Votre site sur mobile, ${p.company}`,
  corps:`Bonjour${prenom},\n\n${ouverture}\n\nDeux choses m'ont sauté aux yeux :\n· ${pr[0]||''}\n· ${pr[1]||''}\n\nJe vous offre le diagnostic complet de votre site, et j'ai imaginé à quoi il pourrait ressembler :\n· Diagnostic : ${r.diagnosticUrl||''}\n· Maquette : ${r.maquetteUrl||''}\n\nDeux formules :\n· Site refait, livré en 10 jours ouvrés — 500 € HT\n· Site + campagne de trafic sur des sites médias premium — 3 500 € HT\n\n15 minutes cette semaine pour en parler ?\n\nRodolph Menten\nOligart Agency\n+33 6 88 35 46 76\noligart-agency.com\n\nSi ce n'est pas le sujet, répondez simplement "non" et je ne vous recontacterai pas.`
 };
}

// Aperçu du mail tel qu'il arrivera : rien ne part sans que Rodolph ait vu
// le rendu réel, liens compris. Se rafraîchit à chaque frappe.
function apercu(){
 const wrap=document.querySelector('#rfMsgModal'); if(!wrap)return;
 const cible=wrap.querySelector('#rfPreview'); if(!cible)return;
 const p=window.Oligart.getProspect(wrap.dataset.id||'');
 const to=wrap.querySelector('#rfTo').value.trim();
 const subject=wrap.querySelector('#rfSubject').value.trim();
 const body=wrap.querySelector('#rfBody').value;
 // On échappe tout, puis on ne réintroduit que les liens — jamais de HTML
 // venant du texte saisi.
 const lignes=E(body).split('\n').map(l=>
   l.replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>')
 ).join('<br>');
 const shot=p&&R(p)&&R(p).shotMobile
   ? `<div class="rf-pv-shot"><img src="${E(R(p).shotMobile)}" alt="Aperçu mobile de la maquette"></div>` : '';
 cible.innerHTML=
  `<div class="rf-pv-de">De : Rodolph Menten &lt;rodolph.menten@oligart.fr&gt;<br>À : ${E(to)||'<span class="rf-pv-vide">destinataire manquant</span>'}</div>`+
  `<div class="rf-pv-obj">${E(subject)||'<span class="rf-pv-vide">objet manquant</span>'}</div>`+
  (body.trim()?lignes:'<span class="rf-pv-vide">message vide</span>')+shot;
}

function ouvrirMessage(id,relance){
 const p=window.Oligart.getProspect(id); if(!p)return;
 const r=R(p);
 if(!relance&&r.status!==ST.VALID){ window.Oligart.toast('Cette fiche n’est pas encore validée.'); return; }
 const d=brouillon(p,relance);
 const wrap=document.querySelector('#rfMsgModal');
 wrap.querySelector('#rfTo').value=p.contactEmail||'';
 wrap.querySelector('#rfSubject').value=d.objet;
 wrap.querySelector('#rfBody').value=d.corps;
 wrap.dataset.id=id; wrap.dataset.relance=relance?'1':'';
 wrap.querySelector('#rfStatus').textContent='';
 wrap.classList.add('open');
 apercu();
}

async function envoyer(viaMailto){
 const wrap=document.querySelector('#rfMsgModal');
 const id=wrap.dataset.id, relance=!!wrap.dataset.relance;
 const p=window.Oligart.getProspect(id); if(!p)return;
 const to=wrap.querySelector('#rfTo').value.trim();
 const subject=wrap.querySelector('#rfSubject').value.trim();
 const text=wrap.querySelector('#rfBody').value;
 const st=wrap.querySelector('#rfStatus');
 if(!to||!subject||!text){ st.textContent='Destinataire, objet et message sont obligatoires.'; return; }

 if(viaMailto){
  window.open('https://mail.google.com/mail/?view=cm&fs=1&to='+encodeURIComponent(to)+
   '&su='+encodeURIComponent(subject)+'&body='+encodeURIComponent(text),'_blank','noopener');
 }else{
  st.textContent='Envoi en cours...';
  try{
   const res=await fetch('/.netlify/functions/send-email',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({to,subject,text})});
   const dd=await res.json().catch(()=>({}));
   if(!res.ok){ st.textContent='Échec : '+(dd.error||res.status); return; }
  }catch(e){ st.textContent='Échec : '+e.message; return; }
 }
 const r=ensure(p);
 if(relance){ r.status=ST.RELANCE; r.relanceAt=''; r.prochaineAction='Sans réponse sous 5 jours → Clos'; }
 else{ r.status=ST.ENVOYE; r.sentAt=window.Oligart.today(); r.relanceAt=joursOuvres(r.sentAt,5);
       r.dernierObjet=subject; r.prochaineAction='Relance le '+r.relanceAt; }
 log(p,(relance?'Relance':'Message')+' '+(viaMailto?'ouvert dans Gmail':'envoyé')+' à '+to+' : « '+subject+' »');
 window.Oligart.addTimelineEntry(p,{channel:'email',type:relance?'refonte-relance':'refonte',status:'sent',to,subject,body:text,
  note:(relance?'Relance':'Message')+' campagne Refonte à '+to});
 window.Oligart.save();
 wrap.classList.remove('open');
 window.Oligart.toast(relance?'Relance enregistrée':'Message enregistré');
}

// --- rendu principal ------------------------------------------------------
function render(){
 if(!window.Oligart)return;
 const sec=document.querySelector('#refonte'); if(!sec)return;
 styles();
 const list=campagne();
 const dash=sec.querySelector('#rfDash'), tbl=sec.querySelector('#rfTable');
 if(!dash||!tbl)return;
 if(!list.length){
  dash.innerHTML='';
  tbl.innerHTML='<p class="muted rf-empty">Aucun prospect n’est encore entré dans cette campagne.<br>Les fiches apparaissent ici dès que le rôle SDR les a auditées.</p>';
  return;
 }
 renderDash(dash,list);
 renderTable(tbl,list);
}

// --- branchements ---------------------------------------------------------
function init(){
 if(!window.Oligart)return;
 const sec=document.querySelector('#refonte'); if(!sec)return;
 styles();

 // filtres
 const sel=sec.querySelector('#rfStatusFilter');
 if(sel){ sel.innerHTML='<option value="">Tous les statuts</option>'+ORDER.map(s=>`<option>${s}</option>`).join('');
  sel.onchange=()=>{filterStatus=sel.value;render()}; }
 const inp=sec.querySelector('#rfSearch');
 if(inp)inp.oninput=()=>{filterQuery=inp.value;render()};

 // délégation : la table est reconstruite à chaque rendu
 sec.addEventListener('click',e=>{
  const th=e.target.closest('[data-rf-sort]');
  if(th){ const k=th.dataset.rfSort; if(sortKey===k)sortDir*=-1; else{sortKey=k;sortDir=k==='company'?1:-1;} render(); return; }
  const open=e.target.closest('[data-rf-open]'); if(open){ fiche(open.dataset.rfOpen); return; }
  const val=e.target.closest('[data-rf-valid]');
  if(val){ const p=window.Oligart.getProspect(val.dataset.rfValid); if(!p)return;
   const r=ensure(p); if(r.status!==ST.MAQ){window.Oligart.toast('Seule une maquette prête peut être validée.');return;}
   r.status=ST.VALID; r.prochaineAction='Préparer le message'; log(p,'Maquette validée par Rodolph');
   window.Oligart.save(); window.Oligart.toast('Validé'); return; }
  const msg=e.target.closest('[data-rf-msg]'); if(msg){ ouvrirMessage(msg.dataset.rfMsg,false); return; }
  const rel=e.target.closest('[data-rf-rel]'); if(rel){ ouvrirMessage(rel.dataset.rfRel,true); return; }
 });

 // le tiroir peut aussi contenir les boutons Valider / Message
 const drawer=document.querySelector('#drawer');
 if(drawer)drawer.addEventListener('click',e=>{
  const val=e.target.closest('[data-rf-valid]');
  if(val){ const p=window.Oligart.getProspect(val.dataset.rfValid); if(!p)return;
   const r=ensure(p); if(r.status!==ST.MAQ)return;
   r.status=ST.VALID; r.prochaineAction='Préparer le message'; log(p,'Maquette validée par Rodolph');
   window.Oligart.save(); window.Oligart.toast('Validé'); drawer.classList.remove('open'); }
  const msg=e.target.closest('[data-rf-msg]'); if(msg){ drawer.classList.remove('open'); ouvrirMessage(msg.dataset.rfMsg,false); }
 });

 // modale message
 const mw=document.querySelector('#rfMsgModal');
 if(mw){
  mw.querySelectorAll('[data-rf-close]').forEach(b=>b.onclick=()=>mw.classList.remove('open'));
  ['#rfTo','#rfSubject','#rfBody'].forEach(sel=>{const el=mw.querySelector(sel); if(el)el.addEventListener('input',apercu)});
  const send=mw.querySelector('#rfSend'); if(send)send.onclick=()=>envoyer(false);
  const gm=mw.querySelector('#rfGmail'); if(gm)gm.onclick=()=>envoyer(true);
  const cp=mw.querySelector('#rfCopy');
  if(cp)cp.onclick=()=>{navigator.clipboard.writeText(mw.querySelector('#rfBody').value).then(()=>window.Oligart.toast('Message copié'))};
 }

 window.Oligart.registerRenderHook(render);
 render();
}

// API utilisée par l'agent pour remplir les fiches depuis la console.
window.OligartRefonte={ ST, PACK, ensure, total, joursOuvres, campagne, render, log };
init();
})();
