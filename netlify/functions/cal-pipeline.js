'use strict';
// PDAS authoritative feed: opportunities from Supabase, enriched by publisher/platform registries.
// Legacy JSON files are used only as a temporary continuity fallback.

const CORS={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
const SB=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||'';
const STATE='CA', PAGE=1000, TTL=5*60*1000;
let cache=null, cacheAt=0;

function headers(extra){return Object.assign({apikey:KEY,authorization:'Bearer '+KEY,accept:'application/json'},extra||{});}
function daysUntil(v){if(!v)return null;const t=Date.parse(v);return Number.isNaN(t)?null:Math.ceil((t-Date.now())/86400000);}
function norm(v){return String(v||'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\b(the|office of|state of california|california)\b/g,' ').replace(/\s+/g,' ').trim();}

async function get(path,query,from){
  const q=new URLSearchParams(query||{}), h=headers({Range:`${from}-${from+PAGE-1}`});
  const r=await fetch(`${SB}/rest/v1/${path}?${q}`,{headers:h,signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error(`${path} HTTP ${r.status}: ${(await r.text().catch(()=>'' )).slice(0,240)}`);
  const data=await r.json();return Array.isArray(data)?data:[];
}
async function all(path,query){const out=[];for(let from=0;;from+=PAGE){const rows=await get(path,query,from);out.push(...rows);if(rows.length<PAGE)break;}return out;}

async function registry(){
  const [pubs,maps,plats]=await Promise.all([
    all('pdas_publishers',{select:'publisher_id,organization_name,organization_type,procurement_search_url,vendor_registration_url,research_status',state_code:`eq.${STATE}`,research_status:'eq.verified'}),
    all('pdas_publisher_platforms',{select:'publisher_id,platform_id,is_primary,public_search_url,vendor_registration_url,active',active:'eq.true'}),
    all('pdas_procurement_platforms',{select:'platform_id,platform_name,technology_vendor,public_search_url,vendor_registration_url,platform_status',platform_status:'eq.active'})
  ]);
  const pById=new Map(plats.map(p=>[p.platform_id,p])), mByPub=new Map();
  maps.forEach(m=>{if(!mByPub.has(m.publisher_id))mByPub.set(m.publisher_id,[]);mByPub.get(m.publisher_id).push(m);});
  const byName=new Map();
  pubs.forEach(p=>{const ms=mByPub.get(p.publisher_id)||[], pm=ms.find(m=>m.is_primary)||ms[0]||null;byName.set(norm(p.organization_name),{publisher:p,mapping:pm,platform:pm?pById.get(pm.platform_id)||null:null});});
  return {pubs,maps,plats,byName};
}
function match(reg,name){const n=norm(name);if(!n)return null;if(reg.byName.has(n))return reg.byName.get(n);let best=null,len=0;for(const [k,v] of reg.byName){if(k.length>=8&&(n.includes(k)||k.includes(n))&&Math.min(k.length,n.length)>len){best=v;len=Math.min(k.length,n.length);}}return best;}

function mapOpp(o,reg){
  const r=match(reg,o.issuing_organization||o.issuing_department), p=r&&r.publisher, m=r&&r.mapping, plat=r&&r.platform;
  const url=o.official_source_url||o.source_url||(m&&m.public_search_url)||(plat&&plat.public_search_url)||(p&&p.procurement_search_url)||'';
  return {
    id:o.source_record_id||o.pdas_record_id||o.id||'',bid_id:o.source_record_id||o.pdas_record_id||o.id||'',
    solicitation_no:o.solicitation_number||o.source_record_id||'',title:o.title||'',bid_type:o.notice_type||o.procurement_type||'SOLICITATION',
    agency:o.issuing_organization||o.issuing_department||'California Public Agency',issue_date:o.posted_at||null,close_date:o.response_deadline||null,
    due_in_days:daysUntil(o.response_deadline),status:o.status||'open',url,category_ids:Array.isArray(o.commodity_codes)?o.commodity_codes:[],
    description:o.description||null,unspsc_codes:Array.isArray(o.unspsc_codes)?o.unspsc_codes:[],contact_name:o.contact_name||null,
    contact_email:o.contact_email||null,contact_phone:o.contact_phone||null,estimated_value_min:o.estimated_value_min??null,
    estimated_value_max:o.estimated_value_max??null,place_of_performance_county:o.place_of_performance_county||null,
    publisher_id:p?p.publisher_id:null,publisher_type:p?p.organization_type:null,procurement_platform:plat?plat.platform_name:o.source_platform,
    technology_vendor:plat?plat.technology_vendor:null,vendor_registration_url:o.vendor_registration_url||(m&&m.vendor_registration_url)||(plat&&plat.vendor_registration_url)||(p&&p.vendor_registration_url)||null,
    registry_verified:Boolean(r),_source:o.source_platform||'pdas'
  };
}

async function fromSupabase(){
  if(!SB||!KEY)throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured');
  const [opps,reg]=await Promise.all([
    all('state_contract_opportunities',{select:'id,pdas_record_id,issuing_organization,issuing_department,source_platform,source_record_id,source_url,official_source_url,vendor_registration_url,solicitation_number,title,description,procurement_type,notice_type,status,posted_at,response_deadline,place_of_performance_county,estimated_value_min,estimated_value_max,contact_name,contact_email,contact_phone,unspsc_codes,commodity_codes,is_latest_version,duplicate_of',state_code:`eq.${STATE}`,is_latest_version:'eq.true',duplicate_of:'is.null',status:'in.(open,upcoming,posted,active)',order:'response_deadline.asc.nullslast,posted_at.desc'}),
    registry()
  ]);
  const bids=opps.map(o=>mapOpp(o,reg)).filter(b=>b.title.length>3&&(b.due_in_days==null||b.due_in_days>=0));
  const source=bids.reduce((a,b)=>(a[b._source]=(a[b._source]||0)+1,a),{});
  return {bids,source,reg};
}

async function legacy(site){
  async function read(file,key){try{const r=await fetch(`${site}/${file}`,{signal:AbortSignal.timeout(8000)});if(!r.ok)return[];const d=await r.json();return Array.isArray(d[key])?d[key]:[];}catch(_){return[];}}
  const [ce,pb,ob]=await Promise.all([read('caleprocure.json','opportunities'),read('bids.json','bids'),read('obas.json','opportunities')]);
  return [
    ...ce.map(o=>({id:o.id||'',bid_id:o.id||'',solicitation_no:o.id||'',title:o.title||'',bid_type:o.bid_type||'SOLICITATION',agency:o.department||'California State Agency',issue_date:o.published_date||null,close_date:o.close_date||null,due_in_days:o.due_in_days??daysUntil(o.close_date),status:o.status||'Posted',url:o.url||'',category_ids:[],description:o.description||null,unspsc_codes:o.unspsc_codes||[],registry_verified:false,_source:'caleprocure'})),
    ...pb.map(b=>({id:b.id||'',bid_id:b.id||'',solicitation_no:b.solicitation_no||'',title:b.title||'',bid_type:b.bid_type||'SOLICITATION',agency:b.agency||'California Local Agency',issue_date:null,close_date:b.close_date||null,due_in_days:b.due_in_days??daysUntil(b.close_date),status:'Open',url:b.url||'',category_ids:b.category_ids||[],registry_verified:false,_source:'planetbids'})),
    ...ob.map(o=>({id:o.id||'',bid_id:o.id||'',solicitation_no:'',title:o.title||'',bid_type:o.category||'SOLICITATION',agency:'DGS (OBAS bulletin)'+(o.location?' — '+o.location:''),issue_date:null,close_date:null,due_in_days:null,status:'Upcoming',url:'',category_ids:[],registry_verified:false,_source:'obas'}))
  ].filter(b=>b.title.length>3);
}

exports.handler=async event=>{
  if(event.httpMethod==='OPTIONS')return{statusCode:204,headers:CORS,body:''};
  if(cache&&Date.now()-cacheAt<TTL)return{statusCode:200,headers:CORS,body:JSON.stringify({...cache,cached:true})};
  try{
    const r=await fromSupabase();
    const payload={ok:true,bids:r.bids,count:r.bids.length,source:r.source,data_source:'supabase',tables:{opportunities:'state_contract_opportunities',publishers:'pdas_publishers',publisher_platforms:'pdas_publisher_platforms',platforms:'pdas_procurement_platforms'},registry:{publishers_loaded:r.reg.pubs.length,platforms_loaded:r.reg.plats.length,mappings_loaded:r.reg.maps.length,bids_enriched:r.bids.filter(b=>b.registry_verified).length},cached:false};
    cache=payload;cacheAt=Date.now();return{statusCode:200,headers:CORS,body:JSON.stringify(payload)};
  }catch(error){
    const site=process.env.URL||process.env.DEPLOY_URL||`https://${event.headers.host}`, bids=await legacy(site), source=bids.reduce((a,b)=>(a[b._source]=(a[b._source]||0)+1,a),{});
    const payload={ok:bids.length>0,bids,count:bids.length,source,data_source:'legacy_json_fallback',fallback:true,error:error.message,cached:false};
    cache=payload;cacheAt=Date.now();return{statusCode:200,headers:CORS,body:JSON.stringify(payload)};
  }
};
