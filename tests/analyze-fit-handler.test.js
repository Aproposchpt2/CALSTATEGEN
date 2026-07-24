const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const handlerUrl=pathToFileURL(path.resolve(__dirname,'../netlify/functions/analyze-fit-state.mjs')).href;
const sourceUrl=pathToFileURL(path.resolve(__dirname,'../netlify/functions/_shared/apropos-procurement-intelligence-v1.mjs')).href;

function assessment(source){
  return {
    score:80,confidence_score:70,recommendation:'GO',eligibility_outcome:'ELIGIBLE_STRONG_MATCH',
    executive_summary:'Evidence supports pursuit.',rationale:'Known gates pass.',strategic_alignment:['Aligned'],
    eligibility:[],capability_evidence:[],competitive_position:{strengths:[],weaknesses:[],advantages:[],threats:[]},risks:[],executive_observations:[],decision_conditions:[],
    action_plan:{immediate:['Open official source.'],next_72_hours:[],first_week:[]},required_work:[],staffing_delivery:[],documents_needed:[],pricing_considerations:[],questions_for_buyer:[],source_notes:['Official solicitation review remains required.'],
    contract_intelligence:{
      hard_gates:source.HARD_GATES.map(g=>({gate_id:g.id,status:'PASS',evidence_state:'KNOWN',evidence:'Verified evidence.',missing_evidence:'None identified.',impact:'No blocking issue.'})),
      fit_factors:source.FIT_FACTORS.map(f=>({factor_id:f.id,weight:f.weight,points_awarded:f.weight,evidence_state:'KNOWN',evidence:'Aligned evidence.'})),
      confidence_factors:source.CONFIDENCE_FACTORS.map(f=>({factor_id:f.id,weight:f.weight,points_awarded:f.weight,evidence_state:'KNOWN',evidence:'Complete evidence.'})),
      requirement_checklist:[{requirement_id:'REQ-CAP-011',status:'SATISFIED',mandatory:false,evidence_state:'KNOWN',opportunity_evidence:'Software scope.',business_evidence:'Software capability.',missing_evidence:'None.',action:'Proceed.'}],
      missing_business_evidence:[],missing_opportunity_evidence:[],disqualifying_conditions:[],questions_for_buyer:[],questions_for_business:[],
      scale_delivery_assessment:{geography:'Aligned',capacity:'Aligned',staffing:'Aligned',schedule:'Aligned',delivery_model:'Aligned'},evidence_ledger:[]
    }
  };
}

test('handler returns source-of-truth envelope and normalized independent scores',async()=>{
  const source=await import(sourceUrl);
  const {default:handler}=await import(handlerUrl);
  const originalFetch=global.fetch;
  const originalKey=process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY='test-key';
  global.fetch=async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/chat/completions');
    const request=JSON.parse(options.body);
    assert.match(request.messages[1].content,/AUTHORITATIVE SOURCE OF TRUTH/);
    assert.match(request.messages[1].content,/Missing evidence lowers confidence, not fit by default/);
    return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(assessment(source))}}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const request=new Request('https://natcorp.example/api/analyze-fit-state',{method:'POST',headers:{origin:'https://natcorp.example','content-type':'application/json'},body:JSON.stringify({bid:{title:'Software services',state_code:'AZ'},profile:{business_name:'Example LLC',services:['Software development']}})});
    const response=await handler(request);
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.source_of_truth.version,'1.0');
    assert.equal(body.report_standard,'APROPOS-CONTRACT-INTELLIGENCE-REPORT-v1');
    assert.equal(body.analysis.score,100);
    assert.equal(body.analysis.confidence_score,100);
    assert.equal(body.analysis.recommendation,'GO');
    assert.equal(body.analysis.contract_intelligence.requirement_checklist[0].requirement_id,'REQ-CAP-011');
  }finally{
    global.fetch=originalFetch;
    if(originalKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=originalKey;
  }
});
