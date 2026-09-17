(()=>{
'use strict';
// Porte d'entrée du CRM.
//
// Les fonctions Netlify sensibles (envoi d'email, lecture de la boîte,
// enrichissement, scans) exigent désormais un jeton dans l'en-tête
// "x-oligart-token". Ce fichier fait deux choses :
//  1. il enveloppe window.fetch pour ajouter l'en-tête à tout appel vers
//     /.netlify/functions/ -- aucun autre fichier n'a besoin d'être modifié ;
//  2. il demande le jeton à l'écran quand il est absent ou refusé.
//
// Le jeton n'est PAS écrit dans ce fichier : il serait alors public, comme
// avant. Il est saisi une fois et conservé dans le localStorage du
// navigateur de Rodolph. Un visiteur qui ouvre l'URL sans le jeton se
// heurte à un 401 sur toutes les fonctions.

const KEY='oligart-token';
const HEADER='x-oligart-token';

function getToken(){ try{return localStorage.getItem(KEY)||''}catch{return ''} }
function setToken(v){ try{localStorage.setItem(KEY,v)}catch{/* navigation privée : le jeton vaut pour la session */} }
function clearToken(){ try{localStorage.removeItem(KEY)}catch{} }

// --- Enveloppe de fetch -----------------------------------------------
const nativeFetch=window.fetch.bind(window);
function isFunctionCall(input){
 try{
  const url=typeof input==='string'?input:(input&&input.url)||'';
  return url.includes('/.netlify/functions/');
 }catch{return false}
}
window.fetch=async function(input,init){
 if(!isFunctionCall(input))return nativeFetch(input,init);
 const opts={...(init||{})};
 const headers=new Headers(opts.headers||(typeof input==='object'&&input.headers)||{});
 const t=getToken();
 if(t)headers.set(HEADER,t);
 opts.headers=headers;
 const res=await nativeFetch(input,opts);
 // 401 = jeton absent ou faux : on redemande, sans casser l'appel en cours.
 if(res.status===401){ clearToken(); openGate('Jeton refusé. Saisis le jeton d’accès.'); }
 // 503 = APP_TOKEN pas encore configurée côté Netlify : message explicite.
 if(res.status===503){ openGate('APP_TOKEN n’est pas encore configurée sur Netlify.'); }
 return res;
};

// --- Écran de saisie ---------------------------------------------------
// Pas de prompt() natif : il bloque la page et passe mal dans les
// navigateurs embarqués. Simple surcouche maison.
let gateOpen=false;
function openGate(message){
 if(gateOpen)return;
 gateOpen=true;
 const wrap=document.createElement('div');
 wrap.id='oligartGate';
 wrap.setAttribute('style','position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(9,12,18,.92);backdrop-filter:blur(4px)');
 const box=document.createElement('div');
 box.setAttribute('style','width:min(420px,90vw);padding:28px;border-radius:14px;background:#141a24;border:1px solid #263141;color:#e8edf5;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.5)');
 const h=document.createElement('h2');
 h.textContent='Oligart Prospect';
 h.setAttribute('style','margin:0 0 6px;font-size:18px;font-weight:650');
 const p=document.createElement('p');
 p.textContent=message||'Saisis le jeton d’accès pour utiliser le CRM.';
 p.setAttribute('style','margin:0 0 18px;color:#93a1b5;font-size:14px');
 const input=document.createElement('input');
 input.type='password';
 input.autocomplete='off';
 input.placeholder='Jeton d’accès';
 input.setAttribute('style','width:100%;box-sizing:border-box;padding:11px 13px;border-radius:9px;border:1px solid #2c3950;background:#0d131c;color:#e8edf5;font-size:15px;outline:none');
 const btn=document.createElement('button');
 btn.textContent='Déverrouiller';
 btn.setAttribute('style','margin-top:14px;width:100%;padding:11px;border-radius:9px;border:0;background:#3b82f6;color:#fff;font-size:15px;font-weight:600;cursor:pointer');
 const note=document.createElement('p');
 note.textContent='Conservé dans ce navigateur uniquement. À saisir une seule fois par appareil.';
 note.setAttribute('style','margin:14px 0 0;color:#66748a;font-size:12px');
 function submit(){
  const v=input.value.trim();
  if(!v)return;
  setToken(v);
  wrap.remove();
  gateOpen=false;
  location.reload();
 }
 btn.onclick=submit;
 input.onkeydown=e=>{if(e.key==='Enter')submit()};
 box.append(h,p,input,btn,note);
 wrap.append(box);
 document.body.append(wrap);
 setTimeout(()=>input.focus(),50);
}

// Au chargement : si aucun jeton n'est mémorisé, on demande tout de suite
// plutôt que de laisser l'utilisateur découvrir des erreurs une par une.
document.addEventListener('DOMContentLoaded',()=>{
 if(!getToken())openGate();
});

// Exposé pour la page Paramètres (bouton "changer le jeton").
window.OligartAuth={getToken,setToken,clearToken,openGate};
})();
