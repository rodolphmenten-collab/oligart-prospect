const { request, config } = require('./_supabase');
const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const reply=(statusCode,body)=>({statusCode,headers,body:JSON.stringify(body)});

function toApp(row){
  const list=Array.isArray(row.contacts)?row.contacts:[];
  const primary=list.find(c=>c.is_primary)||list[0]||{};
  return {id:row.id,company:row.name,sector:row.industry||'',model:row.business_model||'B2B',priority:row.priority||'B',score:row.score||0,status:row.status||'À contacter',contact:primary.full_name||primary.job_title||'CEO',contactEmail:primary.email||'',linkedinUrl:primary.linkedin_url||'',why:row.why_relevant||'',website:row.website||'',jobsUrl:row.jobs_url||row.careers_url||'',last:row.last_contacted_at?String(row.last_contacted_at).slice(0,10):'',next:row.next_follow_up||'',notes:row.notes||primary.notes||'',jobs:[]};
}

async function replaceAll(prospects){
  // Remplacement en bloc : 3 appels API au lieu de centaines, adapté au CRM mono-utilisateur.
  await request('companies?id=not.is.null',{method:'DELETE',headers:{Prefer:'return=minimal'}});
  const companyPayload=prospects.slice(0,1000).map(p=>({
    name:p.company,website:p.website||null,industry:p.sector||null,business_model:p.model||null,
    score:Number(p.score||0),priority:p.priority||'B',status:p.status||'À contacter',
    why_relevant:p.why||null,jobs_url:p.jobsUrl||null,notes:p.notes||null,
    next_follow_up:p.next||null,last_contacted_at:p.last?`${p.last}T12:00:00Z`:null
  }));
  const inserted=await request('companies?select=id,name',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(companyPayload)});
  const byName=new Map((inserted||[]).map(x=>[x.name,x.id]));
  const contactPayload=prospects.map(p=>({
    company_id:byName.get(p.company),full_name:p.contact||null,job_title:p.contact||null,
    email:p.contactEmail||null,email_confidence:p.contactEmail?'vérifié':'introuvable',
    linkedin_url:p.linkedinUrl||null,is_primary:true,notes:p.notes||null
  })).filter(x=>x.company_id&&(x.full_name||x.email||x.linkedin_url));
  if(contactPayload.length) await request('contacts',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(contactPayload)});
  return {synced:inserted?.length||0,errors:[]};
}

exports.handler=async(event)=>{
  try{
    config();
    if(event.httpMethod==='GET'){
      const data=await request('companies?select=*,contacts(*)&order=score.desc');
      return reply(200,{prospects:(data||[]).map(toApp),count:data?.length||0});
    }
    if(event.httpMethod==='POST'){
      const body=JSON.parse(event.body||'{}');
      if(!Array.isArray(body.prospects))return reply(400,{error:'prospects doit être un tableau'});
      return reply(200,await replaceAll(body.prospects));
    }
    return reply(405,{error:'Méthode non autorisée'});
  }catch(error){console.error('companies function error',error);return reply(500,{error:error.message||'Erreur Supabase'});}
};
