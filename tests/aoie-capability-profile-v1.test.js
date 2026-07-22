const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('capability builder separates roles, performed work, and products',()=>{
  const html=fs.readFileSync(path.join(process.cwd(),'capabilities.html'),'utf8');
  assert.match(html,/How does your business operate\?/);
  assert.match(html,/What does your business perform\?/);
  assert.match(html,/What does your business sell or supply\?/);
  assert.match(html,/Generate My Opportunity Dashboard/);
});

test('profile migration enforces visit-scoped server profiles and RLS',()=>{
  const sql=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20260721_aoie_business_capability_profile_v1.sql'),'utf8');
  assert.match(sql,/session_id text/);
  assert.match(sql,/visit_scoped boolean/);
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all .* anon, authenticated/i);
});

test('IT/software profile suppresses physical Window Systems Repair',async()=>{
  const {expandBusinessProfile}=await import('../netlify/functions/_shared/aoie-state-profile.mjs');
  const {scoreStateLocalMatch}=await import('../netlify/functions/_shared/aoie-state-scoring.mjs');
  const profile=expandBusinessProfile({business_name:'IT Systems Company',capabilities:['Software Development & Licensing','Cybersecurity & Access Management'],keywords:['software','systems integration','cybersecurity'],procurement_types:['SOFTWARE','PROFESSIONAL_SERVICE'],service_states:['CA']});
  const result=scoreStateLocalMatch(profile,{title:'Window Systems Repair — School for the Blind',description:'Remove and replace damaged exterior windows, glazing, frames and related building components. Licensed contractor required.',procurement_type:'CONSTRUCTION',state_code:'CA',response_deadline:'2099-12-31T23:59:59Z'});
  assert.equal(result.hard_disqualifier,'PROCUREMENT_TYPE_MISMATCH');
  assert.equal(result.fit_score,0);
  assert.equal(result.match_status,'Not Recommended');
  assert.ok(result.explanation.negative_evidence.length>0);
});

test('software opportunity remains eligible for software profile',async()=>{
  const {expandBusinessProfile}=await import('../netlify/functions/_shared/aoie-state-profile.mjs');
  const {scoreStateLocalMatch}=await import('../netlify/functions/_shared/aoie-state-scoring.mjs');
  const profile=expandBusinessProfile({business_name:'IT Systems Company',capabilities:['Software Development & Licensing'],keywords:['software development','systems integration'],procurement_types:['SOFTWARE'],service_states:['AZ']});
  const result=scoreStateLocalMatch(profile,{title:'Case Management Software Development and Systems Integration',description:'Software application implementation and integration services.',procurement_type:'SOFTWARE',state_code:'AZ',response_deadline:'2099-12-31T23:59:59Z'});
  assert.notEqual(result.hard_disqualifier,'PROCUREMENT_TYPE_MISMATCH');
  assert.ok(result.signal_scores.procurement_type>0);
});

test('service-role key remains server-side',()=>{
  const html=fs.readFileSync(path.join(process.cwd(),'capabilities.html'),'utf8');
  assert.doesNotMatch(html,/SUPABASE_SERVICE_ROLE_KEY/);
  const fn=fs.readFileSync(path.join(process.cwd(),'netlify/functions/_shared/aoie-profile-db.mjs'),'utf8');
  assert.match(fn,/SUPABASE_SERVICE_ROLE_KEY/);
});
