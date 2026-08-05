const { request } = require('./_supabase');

const FEEDS = [
  {name:'Levées France', url:'https://news.google.com/rss/search?q=startup+France+lev%C3%A9e+de+fonds+OR+financement&hl=fr&gl=FR&ceid=FR:fr', type:'funding'},
  {name:'Sales & Growth', url:'https://news.google.com/rss/search?q=startup+France+recrute+sales+OR+growth+OR+marketing&hl=fr&gl=FR&ceid=FR:fr', type:'hiring'},
  {name:'Expansion France', url:'https://news.google.com/rss/search?q=scale-up+ouvre+France+OR+expansion+France+SaaS&hl=fr&gl=FR&ceid=FR:fr', type:'expansion'},
  {name:'D2C & B2C', url:'https://news.google.com/rss/search?q=marque+D2C+France+croissance+OR+lev%C3%A9e&hl=fr&gl=FR&ceid=FR:fr', type:'growth'},
  {name:'AdTech MarTech', url:'https://news.google.com/rss/search?q=AdTech+MarTech+France+lev%C3%A9e+recrutement+croissance&hl=fr&gl=FR&ceid=FR:fr', type:'sector'}
];

function decode(s=''){
  return s.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
}
function tag(block,name){const m=block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'));return decode(m?.[1]||'')}
function parseRss(xml){return [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map(m=>({title:tag(m[0],'title'),link:tag(m[0],'link'),description:tag(m[0],'description'),pubDate:tag(m[0],'pubDate')}));}
function cleanCompany(title){
  let t=title.replace(/\s+-\s+[^-]+$/,'').trim();
  const patterns=[
    /^([^,:–—]{2,60})\s+(?:lève|leve|boucle|annonce|recrute|accélère|accelere|dévoile|devoile|se lance|ouvre)/i,
    /(?:La startup|La start-up|La scale-up|La marque)\s+([^,:–—]{2,50})/i,
    /^([^:–—]{2,50})\s*[:–—]/
  ];
  for(const p of patterns){const m=t.match(p);if(m)return m[1].replace(/^(française?|parisienne?)\s+/i,'').trim()}
  return t.split(/\s+[–—:]\s+/)[0].slice(0,70).trim();
}
function score(title,desc,type){const s=(title+' '+desc).toLowerCase();let n=55;if(/lève|levée|million|financement|série [abc]/.test(s))n+=18;if(/recrut|sales|growth|marketing|commercial|country manager/.test(s))n+=15;if(/france|paris|français/.test(s))n+=5;if(/expansion|croissance|accélère|ouvre/.test(s))n+=8;if(type==='sector')n+=5;return Math.min(98,n)}
function model(title,desc){const s=(title+' '+desc).toLowerCase();if(/d2c|marque|retail|consommateur|beaut|food|mode|e-commerce/.test(s))return 'B2C';if(/marketplace|plateforme/.test(s))return 'B2B/B2C';return 'B2B'}
function sector(title,desc){const s=(title+' '+desc).toLowerCase();if(/adtech|publicit|média|media|marketing/.test(s))return 'AdTech / MarTech';if(/fintech|paiement|banque|assurance/.test(s))return 'FinTech';if(/ia|intelligence artificielle|ai /.test(s))return 'AI';if(/travel|voyage|tourisme/.test(s))return 'Travel';if(/retail|e-commerce|d2c|marque/.test(s))return 'Retail / D2C';if(/saas|logiciel/.test(s))return 'SaaS';return 'Startup / Scale-up'}
async function scanDiscovery(){
  const found=[];
  for(const feed of FEEDS){
    try{
      const r=await fetch(feed.url,{headers:{'user-agent':'OligartProspect/1.0'}});if(!r.ok)continue;
      const xml=await r.text();
      for(const item of parseRss(xml).slice(0,18)){
        if(!item.title||!item.link)continue;
        const company=cleanCompany(item.title);if(company.length<2)continue;
        found.push({company_name:company,website:null,source:feed.name,source_url:item.link,signal_type:feed.type,signal_description:item.title,opportunity_score:score(item.title,item.description,feed.type),status:'nouveau',detected_at:item.pubDate?new Date(item.pubDate).toISOString():new Date().toISOString(),meta:{model:model(item.title,item.description),sector:sector(item.title,item.description)}})
      }
    }catch(e){console.warn('feed error',feed.name,e.message)}
  }
  const unique=[...new Map(found.map(x=>[x.source_url,x])).values()];
  const existing=await request('discovery_items?select=source_url&limit=5000');
  const known=new Set((existing||[]).map(x=>x.source_url));
  const fresh=unique.filter(x=>!known.has(x.source_url)).slice(0,100);
  // meta isn't in schema: fold useful fields into description.
  const payload=fresh.map(({meta,...x})=>({...x,signal_description:`${x.signal_description} || ${meta.sector} || ${meta.model}`}));
  if(payload.length)await request('discovery_items',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(payload)});
  return {scanned:unique.length,added:payload.length,sources:FEEDS.length,checkedAt:new Date().toISOString()};
}
module.exports={scanDiscovery};
