const test = require('node:test');
const assert = require('node:assert/strict');

async function core(){ return import('../netlify/functions/_shared/natcorp-core.mjs'); }

test('idempotency keys are stable and stage-specific', async()=>{
  const {idempotencyKey}=await core();
  assert.equal(idempotencyKey('r1','acquisition'),'r1:acquisition:daily_run:r1');
  assert.notEqual(idempotencyKey('r1','acquisition'),idempotencyKey('r1','executive_reporting'));
});

test('grouped writer gives every PostgREST batch a uniform key set', async()=>{
  const {groupRowsByKeySet}=await core();
  const groups=groupRowsByKeySet([{a:1,b:2},{a:3},{a:4,b:5}]);
  assert.equal(groups.length,2);
  assert.deepEqual(groups.map(g=>g.length).sort(),[1,2]);
});

test('release gate rejects expired and duplicate opportunities', async()=>{
  const {releaseDecision}=await core();
  const result=releaseDecision({status:'open',response_deadline:'2020-01-01',official_source_url:'https://example.com',issuing_organization:'Agency',description:'Scope',requirements:{x:true},duplicate_of:'abc',is_latest_version:true,qa_status:'verified'},Date.parse('2026-07-23'));
  assert.equal(result.status,'rejected');
  assert.ok(result.reasons.includes('invalid_deadline'));
  assert.ok(result.reasons.includes('duplicate'));
});

test('feedback validation preserves clean-session metrics only', async()=>{
  const {normalizeFeedback}=await core();
  const row=normalizeFeedback({session_id:'session-123',relevance_rating:'very_relevant',experience_rating:'excellent',improvement_comment:'More filters',opportunities_viewed:4,analyze_fit_count:2});
  assert.equal(row.session_id,'session-123');
  assert.equal(row.opportunities_viewed,4);
  assert.equal(row.business_name,undefined);
  assert.throws(()=>normalizeFeedback({session_id:'x',relevance_rating:'bad',experience_rating:'good'}));
});

test('executive brief includes failures, customer metrics, and CIO rates', async()=>{
  const {buildExecutiveBrief}=await core();
  const jobs=[
    {agent_type:'acquisition',status:'completed',attempts:2,started_at:'2026-07-23T10:00:00Z',completed_at:'2026-07-23T10:00:01Z',output_payload:{connectors_executed:2,inserted:4,updated:6,connectors:[{job_id:'A',status:'succeeded'},{job_id:'B',status:'failed',error:'blocked'}]}},
    {agent_type:'intelligence_processing',status:'completed',attempts:1,started_at:'2026-07-23T10:00:01Z',completed_at:'2026-07-23T10:00:02Z',output_payload:{opportunities_processed:10,contract_dna_completed:8,enrichment_required:2}},
    {agent_type:'release_eligibility_aoie',status:'completed',attempts:1,output_payload:{opportunities_evaluated:10,eligible:5,rejected:3,enrichment_required:2}},
    {agent_type:'dashboard_delivery',status:'completed',attempts:1,output_payload:{released:5}},
  ];
  const brief=buildExecutiveBrief({run:{},jobs,feedback:[{relevance_rating:'very_relevant',experience_rating:'excellent',opportunities_viewed:3,analyze_fit_count:1,improvement_comment:'More filters'}],inventory:{evaluated:10,eligible:5,current_actionable:5,sessions:1}});
  assert.equal(brief.enterprise_status,'OPERATING WITH WARNINGS');
  assert.equal(brief.metrics.customer_intelligence.relevance_score,100);
  assert.equal(brief.metrics.cio_decision_metrics.dashboard_eligibility_rate,50);
  assert.equal(brief.metrics.system_health.retry_count,1);
});
