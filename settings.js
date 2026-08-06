(()=>{
'use strict';
// Paramètres : signature/portfolio/CV stockés localement (localStorage), et
// statut des intégrations (SMTP, IA) interrogé via une fonction Netlify qui ne
// renvoie jamais de secret. Module entièrement indépendant : une erreur ici ne
// peut pas affecter les prospects ni les autres vues.
const KEY='oligart-settings';
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
function persist(s){try{localStorage.setItem(KEY,JSON.stringify(s))}catch{/* stockage indisponible : on continue sans casser l'UI */}}

function fillForm(s){
 const set=(id,v)=>{const el=document.querySelector(id);if(el)el.value=v||''};
 set('#sName',s.name);set('#sTitle',s.title);set('#sEmail',s.email);set('#sPhone',s.phone);set('#sPortfolio',s.portfolio);set('#sCv',s.cv);
}

async function renderIntegrationStatus(){
 const el=document.querySelector('#integrationStatus');
 if(!el)return;
 el.innerHTML='<p class="muted">Vérification en cours...</p>';
 try{
  const r=await fetch('/.netlify/functions/status');
  if(!r.ok)throw new Error('status indisponible');
  const {smtp,ai}=await r.json();
  el.innerHTML=`<label>SMTP (envoi d'emails)<p><span class="pill">${smtp?'✅ Configuré':'⚪ Non configuré'}</span></p></label><label>Assistant IA<p><span class="pill">${ai?'✅ Configuré':'⚪ Non configuré'}</span></p></label>`;
 }catch{
  // Jamais bloquant : si la fonction est indisponible (dev local, déploiement en cours),
  // on informe simplement sans faire échouer le reste de la page Paramètres.
  el.innerHTML='<p class="muted">Statut indisponible pour le moment (fonction Netlify non joignable). L\'app reste utilisable normalement.</p>';
 }
}

function init(){
 const s=load();
 fillForm(s);
 const form=document.querySelector('#settingsForm');
 if(form){
  form.onsubmit=e=>{
   e.preventDefault();
   const next={
    name:document.querySelector('#sName').value.trim(),
    title:document.querySelector('#sTitle').value.trim(),
    email:document.querySelector('#sEmail').value.trim(),
    phone:document.querySelector('#sPhone').value.trim(),
    portfolio:document.querySelector('#sPortfolio').value.trim(),
    cv:document.querySelector('#sCv').value.trim()
   };
   persist(next);
   if(window.Oligart)window.Oligart.toast('Paramètres enregistrés');
  };
 }
 renderIntegrationStatus();
 const scanBtn=document.querySelector('#scanTriggerBtn');
 const scanStatus=document.querySelector('#scanTriggerStatus');
 if(scanBtn){
  scanBtn.onclick=async()=>{
   scanBtn.disabled=true;
   scanStatus.textContent='Scan en cours (recherche web + IA)... ça peut prendre 20 à 40 secondes.';
   try{
    const r=await fetch('/.netlify/functions/scan-trigger',{method:'POST'});
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||'Scan indisponible');
    const radarMsg=data.radar?.skipped?`Radar : ${data.radar.reason}`:`Radar : ${data.radar.added} nouveau(x) signal(aux)`;
    const careerMsg=data.career?.skipped?`Carrière : ${data.career.reason}`:`Carrière : ${data.career.added} nouvelle(s) suggestion(s)`;
    scanStatus.textContent=`${radarMsg} · ${careerMsg}`;
    if(window.Oligart)window.Oligart.toast('Scan terminé');
   }catch(e){
    // Jamais bloquant : une erreur ici (fonction pas déployée, quota, etc.)
    // affiche juste un message clair, sans casser le reste de la page.
    scanStatus.textContent="Scan indisponible pour le moment ("+(e.message||'erreur inconnue')+"). Les scans planifiés quotidiens continueront de tourner normalement.";
   }finally{
    scanBtn.disabled=false;
   }
  };
 }
}
try{init()}catch(e){console.warn('[oligart] settings module failed to init, rest of app unaffected:',e)}

// Exposé pour que d'autres modules (ex. ai.js) puissent réutiliser la signature
// sans dupliquer la logique de lecture du localStorage.
window.OligartSettings={get:load};
})();
