const BASE=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||'';
const headers={apikey:KEY,Authorization:`Bearer ${KEY}`};
const CURRENT=new Set(['open','active','posted','upcoming','open_continuous']);
const HISTORICAL=new Set(['closed','awarded','cancelled','withdrawn','archived','evaluation','intent_to_award']);
const text=v=>String(v??'').trim();
const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
function meaningfulRequirements(v){
  if(Array.isArray(v))return v.some(x=>typeof x==='string'?text(x).length>8:Object.keys(obj(x)).length>0);
  if(v&&typeof v==='object')return Object.entries(v).some(([k,x])=>{
    if(['response_method','mandatory_prebid','contractor_license'].includes(k)&&(!x||x==='See official event package'))return false;
    if(Array.isArray(x))return x.length>0;
    if(x&&typeof x==='object')return Object.keys(x).length>0;
    return text(x).length>8;
  });
  return text(v).length>8;
}
function meaningfulDescription(r){const d=text(r.description);return d.length>40&&d.toLowerCase()!==text(r.title).toLowerCase();}
function hasDocuments(r){return arr(r.document_urls).length>0||arr(obj(r.raw_source_payload).documents).length>0;}
function hasContact(r){return Boolean(text(r.contact_name)&&(text(r.contact_email)||text(r.contact_phone)));}
function eligible(r,now){
  const status=text(r.status).toLowerCase();
  const deadline=r.response_deadline?Date.parse(r.response_deadline):NaN;
  return CURRENT.has(status)&&(!Number.isFinite(deadline)||deadline>=now)&&Boolean(text(r.official_source_url||r.source_url))&&Boolean(text(r.issuing_organization))&&(meaningfulDescription(r)||hasDocuments(r))&&meaningfulRequirements(r.requirements)&&hasContact(r)&&!['enrichment_required','rejected','failed'].includes(text(r.qa_status).toLowerCase());
}
async function rows(table,select='*',pageSize=1000){let out=[];for(let from=0;;from+=pageSize){const url=`${BASE}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=created_at.asc&offset=${from}&limit=${pageSize}`;const r=await fetch(url,{headers});if(!r.ok)throw new Error(`${table}: ${r.status} ${await r.text()}`);const page=await r.json();out.push(...page);if(page.length<pageSize)break;}return out;}
const group=(items,key)=>Object.entries(items.reduce((m,x)=>{const k=text(x[key])||'Unknown';m[k]=(m[k]||0)+1;return m},{})).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);
export const handler=async()=>{try{
  if(!BASE||!KEY)throw new Error('Supabase environment is not configured');
  const opportunities=await rows('state_contract_opportunities','pdas_record_id,state_code,status,title,description,response_deadline,official_source_url,source_url,issuing_organization,issuing_department,source_platform,contact_name,contact_email,contact_phone,document_urls,requirements,raw_source_payload,qa_status,created_at,updated_at');
  let publishers=[],jobs=[],runs=[];
  try{publishers=await rows('pdas_publishers','publisher_id,organization_name,research_status,monitoring_status,created_at')}catch{}
  try{jobs=await rows('pdas_acquisition_jobs','job_id,job_name,source_platform,job_status,last_success_at,last_records_inserted,consecutive_failures,next_scheduled_at,created_at')}catch{}
  try{runs=(await rows('pdas_acquisition_runs','run_id,ingestion_run_id,job_id,run_status,started_at,records_discovered,records_inserted,records_updated,records_failed,created_at')).sort((a,b)=>Date.parse(b.started_at||0)-Date.parse(a.started_at||0)).slice(0,25)}catch{}
  const now=Date.now(),eligibleRows=opportunities.filter(r=>eligible(r,now));
  const currentRows=opportunities.filter(r=>CURRENT.has(text(r.status).toLowerCase()));
  const historicalRows=opportunities.filter(r=>HISTORICAL.has(text(r.status).toLowerCase()));
  const requirementRows=opportunities.filter(r=>meaningfulRequirements(r.requirements));
  const contactRows=opportunities.filter(hasContact);
  const documentRows=opportunities.filter(hasDocuments);
  const enrichmentRows=opportunities.filter(r=>!eligible(r,now));
  const issuingOrganizationCount=new Set(opportunities.map(r=>text(r.issuing_organization)).filter(Boolean)).size;
  const sourcePlatformCount=new Set(opportunities.map(r=>text(r.source_platform)).filter(Boolean)).size;
  return {statusCode:200,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify({ok:true,generated_at:new Date().toISOString(),tables:{opportunities:'public.state_contract_opportunities',publishers:'public.pdas_publishers'},summary:{eligible_contracts:eligibleRows.length,total_opportunities:opportunities.length,current_opportunities:currentRows.length,historical_opportunities:historicalRows.length,enrichment_required:enrichmentRows.length,records_with_requirements:requirementRows.length,records_with_contacts:contactRows.length,records_with_documents:documentRows.length,registered_publisher_count:publishers.length,issuing_organization_count:issuingOrganizationCount,source_platform_count:sourcePlatformCount,acquisition_job_count:jobs.length,active_job_count:jobs.filter(j=>['active','scheduled','idle','success','succeeded'].includes(text(j.job_status).toLowerCase())).length,failed_job_count:jobs.filter(j=>text(j.job_status).toLowerCase()==='failed').length,added_last_24h:opportunities.filter(r=>Date.parse(r.created_at||0)>=now-86400000).length},states:group(opportunities,'state_code'),sources:group(opportunities,'source_platform').slice(0,20),organizations:group(opportunities,'issuing_organization').slice(0,20),jobs,recent_runs:runs,eligibility_definition:['current status','future deadline','official source','identified issuer','meaningful scope or documents','substantive requirements','published contact pathway','QA release eligible']})};
}catch(error){return{statusCode:500,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify({ok:false,error:error.message})}}};