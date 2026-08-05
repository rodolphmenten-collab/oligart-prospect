const { request, config } = require('./_supabase');
const { scanDiscovery } = require('./_discovery-engine');
const reply=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(body)});
exports.handler=async(event)=>{try{config();if(event.httpMethod==='POST'){const result=await scanDiscovery();return reply(200,result)}if(event.httpMethod==='GET'){const data=await request('discovery_items?select=*&order=detected_at.desc&limit=200');return reply(200,{items:data||[],count:data?.length||0})}return reply(405,{error:'Méthode non autorisée'})}catch(e){console.error(e);return reply(500,{error:e.message||'Discovery impossible'})}};
