(()=>{
'use strict';
// Synchronisation de la base avec le serveur (Netlify Blobs).
//
// Ce fichier se charge AVANT data.js. Il fait deux choses :
//  1. au chargement, il récupère la base serveur et la place dans le
//     localStorage, pour que data.js démarre sur la version partagée ;
//  2. il intercepte les écritures du localStorage et les repousse au
//     serveur, sans que le reste de l'app ait à le savoir.
//
// Principe de prudence : si le serveur ne répond pas, on ne bloque rien et
// on ne vide surtout rien. L'app repart sur la copie locale et un bandeau
// signale que la synchro est coupée -- mieux vaut une base locale à jour
// qu'une base vide qui ferait croire à une perte de données.

const LS_KEY='oligart-clean-data';
const FN='/.netlify/functions/crm-data';
const HEADER='x-oligart-token';
let rev=null, online=false, pushing=false, pending=false, lastPush=0;

function token(){ try{return localStorage.getItem('oligart-token')||''}catch{return ''} }

// --- 1. Chargement initial ------------------------------------------------
// XHR synchrone, à dessein : data.js lit le localStorage dès son exécution,
// donc la base partagée doit être en place avant. C'est une API dépréciée,
// mais ici elle bloque quelques centaines de millisecondes au démarrage d'un
// outil interne mono-utilisateur -- le coût est négligeable face au bénéfice
// (tout le monde voit la même base). Revoir si l'app devient multi-onglets.
function pull(){
 const t=token();
 if(!t)return; // pas encore déverrouillé : auth.js s'en occupe
 try{
  const x=new XMLHttpRequest();
  x.open('GET',FN,false);
  x.setRequestHeader(HEADER,t);
  x.send(null);
  if(x.status!==200){ console.warn('[oligart] synchro indisponible (HTTP '+x.status+'), base locale conservée'); return; }
  const d=JSON.parse(x.responseText||'{}');
  rev=d.rev||0; online=true;
  if(Array.isArray(d.prospects)&&d.prospects.length){
   localStorage.setItem(LS_KEY,JSON.stringify(d.prospects));
  }else{
   // Serveur vide (première mise en service) : on garde le local, la
   // première sauvegarde le peuplera.
   console.info('[oligart] base serveur vide, initialisation depuis la copie locale');
  }
 }catch(e){ console.warn('[oligart] synchro indisponible, base locale conservée :',e.message); }
}

// --- 2. Écritures ---------------------------------------------------------
async function push(){
 if(!online||pushing)return;
 pushing=true; pending=false;
 let body;
 try{ body=localStorage.getItem(LS_KEY)||'[]'; }catch{ pushing=false; return; }
 try{
  const r=await fetch(FN,{method:'PUT',headers:{'Content-Type':'application/json',[HEADER]:token()},
   body:JSON.stringify({rev,prospects:JSON.parse(body)})});
  const d=await r.json().catch(()=>({}));
  if(r.status===409){
   // Quelqu'un (ou un autre onglet) a écrit entre-temps. On ne tranche pas
   // à sa place : on alerte et on cesse de pousser, pour ne rien écraser.
   online=false;
   banner("Cette base a été modifiée ailleurs. Recharge la page avant de continuer, sinon tes modifications écraseraient les autres.");
   return;
  }
  if(!r.ok){ console.warn('[oligart] sauvegarde serveur refusée :',d.error||r.status); return; }
  rev=d.rev; lastPush=Date.now(); stamp();
 }catch(e){ console.warn('[oligart] sauvegarde serveur échouée :',e.message); }
 finally{ pushing=false; if(pending)setTimeout(push,400); }
}

function schedule(){ if(!online)return; if(pushing){pending=true;return;} clearTimeout(schedule._t); schedule._t=setTimeout(push,600); }

// Interception : toute écriture de la base, d'où qu'elle vienne, est
// repoussée. On n'a ainsi pas à modifier app.js ni les modules.
const nativeSet=localStorage.setItem.bind(localStorage);
localStorage.setItem=function(k,v){ nativeSet(k,v); if(k===LS_KEY)schedule(); };

// --- 3. Indicateur visible ------------------------------------------------
function banner(msg){
 let b=document.getElementById('oligartSyncBanner');
 if(!b){ b=document.createElement('div'); b.id='oligartSyncBanner';
  b.setAttribute('style','position:fixed;top:0;left:0;right:0;z-index:99998;padding:10px 16px;background:#7f1d1d;color:#fff;font:14px/1.4 system-ui,sans-serif;text-align:center');
  document.body.prepend(b); }
 b.textContent=msg;
}
function stamp(){
 const el=document.getElementById('oligartSyncStamp'); if(!el)return;
 el.textContent='Synchronisé avec le serveur — '+new Date(lastPush).toLocaleTimeString('fr-FR');
}
document.addEventListener('DOMContentLoaded',()=>{
 const host=document.querySelector('.side-bottom small');
 if(host){
  host.id='oligartSyncStamp';
  host.textContent=online?'Base partagée (serveur).':'Hors ligne : données sur cet appareil uniquement.';
  if(!online)host.style.color='#f59e0b';
 }
});

pull();
window.OligartStore={ pull, push, get rev(){return rev}, get online(){return online} };
})();
