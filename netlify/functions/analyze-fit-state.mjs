const JSON_HEADERS={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});
const env=(name)=>globalThis.Netlify?.env?.get(name)||process.env[name]||'';
const arr=(value)=>Array.isArray(value)?value.filter(Boolean):value==null||value===''?[]:[String(value)];
const clip=(value,max=5000)=>String(value??'').slice(0,max);

function sameOrigin(req){
  const target=new URL(req.url);
  const origin=req.headers.get('origin');
  const referer=req.headers.get('referer');
  const site=req.headers.get('sec-fetch-site');
  if(origin&&origin!==target.origin)return false;
  if(referer){try{if(new URL(referer).origin!==target.origin)return false}catch{return false}}
  if(site&&!['same-origin','none'].includes(site))return false;
  return origin===target.origin||Boolean(referer)||site==='same-origin';
}

const STATUS={type:'string',enum:['ALIGNED','VERIFY','GAP','NOT_APPLICABLE']};
const RATING={type:'string',enum:['STRONG','PARTIAL','GAP','UNKNOWN']};
const LEVEL={type:'string',enum:['LOW','MEDIUM','HIGH','INFORMATION']};
const STR={type:'string'};
const STRINGS=(maxItems)=>({type:'array',items:STR,maxItems});

const SCHEMA={
  type:'object',additionalProperties:false,
  required:['score','recommendation','executive_summary','rationale','strategic_alignment','eligibility','capability_evidence','competitive_position','risks','executive_observations','decision_conditions','action_plan','required_work','staffing_delivery','documents_needed','pricing_considerations','questions_for_buyer','source_notes'],
  properties:{
    score:{type:'integer',minimum:0,maximum:100},
    recommendation:{type:'string',enum:['GO','CONDITIONAL','NO-GO']},
    executive_summary:STR,
    rationale:STR,
    strategic_alignment:STRINGS(6),
    eligibility:{type:'array',maxItems:8,items:{type:'object',additionalProperties:false,required:['factor','status','detail','executive_note'],properties:{factor:STR,status:STATUS,detail:STR,executive_note:STR}}},
    capability_evidence:{type:'array',maxItems:8,items:{type:'object',additionalProperties:false,required:['requirement','evidence','rating','gap','action'],properties:{requirement:STR,evidence:STR,rating:RATING,gap:STR,action:STR}}},
    competitive_position:{type:'object',additionalProperties:false,required:['strengths','weaknesses','advantages','threats'],properties:{strengths:STRINGS(5),weaknesses:STRINGS(5),advantages:STRINGS(5),threats:STRINGS(5)}},
    risks:{type:'array',maxItems:10,items:{type:'object',additionalProperties:false,required:['domain','level','finding','mitigation'],properties:{domain:STR,level:LEVEL,finding:STR,mitigation:STR}}},
    executive_observations:{type:'array',maxItems:6,items:{type:'object',additionalProperties:false,required:['title','observation'],properties:{title:STR,observation:STR}}},
    decision_conditions:STRINGS(8),
    action_plan:{type:'object',additionalProperties:false,required:['immediate','next_72_hours','first_week'],properties:{immediate:STRINGS(5),next_72_hours:STRINGS(5),first_week:STRINGS(5)}},
    required_work:STRINGS(8),
    staffing_delivery:STRINGS(8),
    documents_needed:STRINGS(8),
    pricing_considerations:STRINGS(6),
    questions_for_buyer:STRINGS(7),
    source_notes:STRINGS(8)
  }
};

function opportunityText(bid){
  const aoie=bid?._aoie?.aoie||bid?.aoie||{};
  const explanation=aoie.explanation||{};
  return JSON.stringify({
    title:bid.title||'',agency:bid.agency||bid.issuing_organization||'',solicitation_number:bid.solicitation_no||bid.solicitation_number||bid.id||'',
    type:bid.bid_type||bid.procurement_type||bid.notice_type||'',status:bid.status||'',issue_date:bid.issue_date||bid.posted_at||'',deadline:bid.close_date||bid.response_deadline||bid.deadline||'',days_remaining:bid.due_in_days,
    description:clip(bid.description,6000),official_source_url:bid.url||bid.official_source_url||bid.source_url||'',documents:arr(bid.documents||bid.document_urls).slice(0,20),
    naics_codes:arr(bid.naics_codes||bid.naics_code),unspsc_codes:arr(bid.unspsc_codes),commodity_codes:arr(bid.commodity_codes||bid.category_ids),
    required_certifications:arr(bid.required_certifications),required_licenses:arr(bid.required_licenses),set_asides:arr(bid.set_asides||bid.set_aside),estimated_value_min:bid.estimated_value_min,estimated_value_max:bid.estimated_value_max,
    aoie_match_score:aoie.fit_score,aoie_match_status:aoie.match_status,aoie_confidence:aoie.confidence,aoie_match_reasons:arr(explanation.why_matched),aoie_verification_items:arr(explanation.verify_before_pursuit)
  });
}

function profileText(profile){
  return JSON.stringify({
    business_name:profile.business_name||profile.legal_name||profile.company_name||'NAT-CORP Visitor',
    keywords:arr(profile.keywords),services:arr(profile.services),core_competencies:arr(profile.core_competencies||profile.competencies),
    naics_codes:arr(profile.naics_codes||profile.naics),unspsc_codes:arr(profile.unspsc_codes||profile.unspsc),commodity_codes:arr(profile.commodity_codes||profile.commodity),
    licenses:arr(profile.licenses),certifications:arr(profile.certifications||profile.socio_economic_status),service_states:arr(profile.service_states||profile.states||profile.state),
    max_contract_value:profile.max_contract_value||profile.capacity||null,past_performance:clip(profile.past_performance||profile.experience||'',3000)
  });
}

function promptFor(bid,profile){
  return `You are the APROPOS GROUP LLC executive state-and-local procurement analyst. Produce a decision-grade Executive Opportunity Assessment answering one question: Should this business pursue this opportunity?

This is a state or local government procurement opportunity. Do not import federal-only requirements unless they are explicitly present in the opportunity data. Distinguish verified evidence, reported business information, assumptions, unknowns, and required validation. Never invent licenses, certifications, past performance, pricing, eligibility, or solicitation terms.

BUSINESS PROFILE
${profileText(profile)}

OPPORTUNITY AND AOIE MATCH EVIDENCE
${opportunityText(bid)}

ANALYSIS RULES
1. AOIE is preliminary matching evidence, not the final bid/no-bid decision. Use its score and reasons as one input.
2. Capability alignment must be tied to actual selected services, classifications, or opportunity language.
3. Missing information is UNKNOWN or VERIFY, not automatically a failure.
4. A confirmed scope mismatch, expired deadline, mandatory eligibility failure, or material delivery gap may support NO-GO.
5. Use GO only when the available evidence supports a credible pursuit and no material disqualifier is visible.
6. Use CONDITIONAL when the opportunity is relevant but major requirements, evidence, eligibility, staffing, pricing, or schedule questions remain.
7. Build an evidence ledger, risk register, executive observations, decision conditions, and time-phased action plan.
8. Source notes must state what information was available and what still requires the official solicitation.
9. Keep each item concise, specific, and suitable for an executive report.

SCORING GUIDANCE
GO: 75-100
CONDITIONAL: 45-74
NO-GO: 0-44

Return only the structured JSON required by the schema.`;
}

function normalize(value){
  const v=value&&typeof value==='object'?value:{};
  let score=Math.max(0,Math.min(100,Math.round(Number(v.score)||0)));
  let recommendation=['GO','CONDITIONAL','NO-GO'].includes(v.recommendation)?v.recommendation:score>=75?'GO':score>=45?'CONDITIONAL':'NO-GO';
  if(recommendation==='GO'&&score<75)score=75;
  if(recommendation==='CONDITIONAL')score=Math.max(45,Math.min(74,score));
  if(recommendation==='NO-GO'&&score>44)score=44;
  return {...v,score,recommendation};
}

async function openAI(prompt,key){
  const response=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:env('OPENAI_MODEL')||'gpt-4o-mini',temperature:0.1,max_tokens:5000,messages:[{role:'system',content:'Produce evidence-aware executive state/local government opportunity assessments. Follow the supplied schema exactly and never invent missing facts.'},{role:'user',content:prompt}],response_format:{type:'json_schema',json_schema:{name:'state_local_executive_opportunity_assessment',strict:true,schema:SCHEMA}}})
  });
  if(!response.ok)throw new Error(`OpenAI ${response.status}: ${(await response.text().catch(()=>'' )).slice(0,300)}`);
  const data=await response.json();
  const text=data.choices?.[0]?.message?.content||'';
  if(!text)throw new Error('OpenAI returned an empty assessment.');
  return normalize(JSON.parse(text));
}

async function anthropic(prompt,key){
  const response=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',headers:{'x-api-key':key,'anthropic-version':'2023-06-01','Content-Type':'application/json'},
    body:JSON.stringify({model:env('ANTHROPIC_MODEL')||'claude-3-5-haiku-latest',max_tokens:5000,temperature:0.1,messages:[{role:'user',content:`${prompt}\n\nReturn one valid JSON object containing every required field in the requested structure.`}]})
  });
  if(!response.ok)throw new Error(`Anthropic ${response.status}: ${(await response.text().catch(()=>'' )).slice(0,300)}`);
  const data=await response.json();
  const text=data.content?.map(x=>x.text||'').join('')||'';
  const match=text.match(/\{[\s\S]*\}/);
  if(!match)throw new Error('Anthropic returned an invalid assessment.');
  return normalize(JSON.parse(match[0]));
}

export default async function handler(req){
  if(req.method!=='POST')return json(405,{ok:false,error:'POST only'});
  if(!sameOrigin(req))return json(403,{ok:false,error:'Same-origin NAT-CORP access required.'});
  let body;try{body=await req.json()}catch{return json(400,{ok:false,error:'Invalid JSON request.'})}
  const bid=body.bid||{},profile=body.profile||{};
  if(!bid.title)return json(400,{ok:false,error:'Opportunity title required.'});
  const prompt=promptFor(bid,profile);
  const errors=[];
  const openAIKey=env('OPENAI_API_KEY');
  const anthropicKey=env('ANTHROPIC_API_KEY');
  if(openAIKey){try{return json(200,{ok:true,provider:'openai',report_standard:'APROPOS-EOA-11P-STATE-LOCAL-v1',analysis:await openAI(prompt,openAIKey)})}catch(error){console.error('[analyze-fit-state] OpenAI',error);errors.push(error.message)}}
  if(anthropicKey){try{return json(200,{ok:true,provider:'anthropic',report_standard:'APROPOS-EOA-11P-STATE-LOCAL-v1',analysis:await anthropic(prompt,anthropicKey)})}catch(error){console.error('[analyze-fit-state] Anthropic',error);errors.push(error.message)}}
  return json(openAIKey||anthropicKey?502:503,{ok:false,error:openAIKey||anthropicKey?'The assessment providers could not complete the report.':'AI assessment is not configured.',diagnostic:errors.join(' | ').slice(0,700)});
}

export const config={path:'/api/analyze-fit-state'};
