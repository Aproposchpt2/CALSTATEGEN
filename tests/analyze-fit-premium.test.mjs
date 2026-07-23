import assert from 'node:assert/strict';
import fs from 'node:fs';

const files={
  intake:fs.readFileSync('welcome.html','utf8'),
  businessIntake:fs.readFileSync('business-dna-builder-preview.html','utf8'),
  dashboard:fs.readFileSync('aois-dashboard-preview.html','utf8'),
  analyzeFit:fs.readFileSync('analyze-fit-v2.html','utf8'),
  netlify:fs.readFileSync('netlify.toml','utf8'),
  aoieFunction:fs.readFileSync('netlify/functions/aoie-state-shadow.mjs','utf8'),
  analyzeFunction:fs.readFileSync('netlify/functions/analyze-fit-state.mjs','utf8'),
};

function compileInlineScripts(name,html){
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match=>match[1])
    .filter(script=>script.trim());
  assert.ok(scripts.length,`${name} must contain an executable inline script.`);
  for(const script of scripts)new Function(script);
}

compileInlineScripts('Intake',files.intake);
compileInlineScripts('Business Intake',files.businessIntake);
compileInlineScripts('Dashboard',files.dashboard);
compileInlineScripts('Analyze Fit',files.analyzeFit);

const reportSections=[
  'Strategic Alignment',
  'Eligibility Ledger',
  'Capability Evidence',
  'Competitive Strengths',
  'Weaknesses and Threats',
  'Risk Register',
  'Decision Conditions',
  'Immediate Actions',
  'Next 72 Hours',
  'Documents Needed',
  'Questions for Buyer',
  'Source Notes and Limits',
];
for(const title of reportSections)assert.ok(files.analyzeFit.includes(title),`Missing Analyze Fit section: ${title}`);

assert.ok(files.intake.includes('/business-intake#profile='),'Intake must hand off to Business Intake.');
assert.ok(files.businessIntake.includes('/dashboard#profile='),'Business Intake must hand off to Dashboard.');
assert.ok(files.dashboard.includes('/api/aoie-state-shadow'),'Dashboard must use the live AOIE endpoint.');
assert.ok(files.dashboard.includes('/analyze-fit#assessment='),'Dashboard must hand the selected opportunity to Analyze Fit.');
assert.ok(files.analyzeFit.includes('/api/analyze-fit-state'),'Analyze Fit must use the live assessment endpoint.');
assert.ok(files.analyzeFit.includes("location.replace('/intake')"),'Invalid Analyze Fit access must restart Intake.');
assert.ok(files.analyzeFit.includes('No substitute or demonstration assessment is displayed.'),'Analyze Fit must fail closed without a demo report.');

for(const [name,html] of Object.entries({
  Intake:files.intake,
  'Business Intake':files.businessIntake,
  Dashboard:files.dashboard,
  'Analyze Fit':files.analyzeFit,
})){
  assert.ok(!/\b(?:localStorage|sessionStorage)\b/.test(html),`${name} must not use browser storage.`);
  assert.ok(!/document\.cookie/.test(html),`${name} must not create a cookie.`);
}

for(const path of ['/intake.html','/dashboard.html','/analyze-fit.html','/stage','/stage.html','/proposal','/proposal.html','/pdas-dashboard']){
  const escaped=path.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const rule=new RegExp(`from = "${escaped}"[\\s\\S]*?to = "/intake"[\\s\\S]*?force = true`);
  assert.match(files.netlify,rule,`${path} must restart Intake through a forced redirect.`);
}
assert.ok(!files.netlify.includes('to = "/stage.html"'),'The retired stage page must not be routable.');
assert.ok(!files.netlify.includes('to = "/pdas-dashboard.html"'),'The missing PDAS dashboard page must not be routable.');

assert.ok(!files.aoieFunction.includes('session_token'),'AOIE must not accept legacy member sessions.');
assert.ok(!files.aoieFunction.includes('state_alert_subscribers'),'AOIE must not restore subscriber profiles.');
assert.ok(files.aoieFunction.includes('filterReleaseReadyOpportunities'),'AOIE must apply the actionable opportunity release gate.');
assert.ok(files.aoieFunction.includes('release_official_source_filter_applied: true'),'AOIE must report its official-source release filter.');
assert.ok(files.aoieFunction.includes('release_future_deadline_filter_applied: true'),'AOIE must report its future-deadline release filter.');
assert.ok(files.aoieFunction.includes('release_issuing_entity_filter_applied: true'),'AOIE must report its issuing-entity release filter.');
assert.ok(files.aoieFunction.includes('release_meaningful_evidence_filter_applied: true'),'AOIE must report its scope/document evidence release filter.');
assert.ok(files.aoieFunction.includes('release_substantive_requirements_filter_applied: true'),'AOIE must report its substantive-requirements release filter.');
assert.ok(files.aoieFunction.includes('release_extraction_confidence_filter_applied: true'),'AOIE must report its extraction-confidence release filter.');
assert.ok(files.aoieFunction.includes('release_qa_filter_applied: true'),'AOIE must report its QA release filter.');
assert.ok(files.aoieFunction.includes('rateLimit'),'AOIE must have a platform rate limit.');
assert.ok(files.analyzeFunction.includes('rateLimit'),'Analyze Fit must have a platform rate limit.');

const retiredFunctions=[
  'netlify/functions/analyze-fit-ca.js',
  'netlify/functions/extract-profile-ca.js',
  'netlify/functions/proposal-writer-ca.js',
  'netlify/functions/pdas-dashboard.js',
  'netlify/functions/cal-pipeline.js',
  'netlify/functions/cal-detail.js',
  'netlify/functions/aois-advisor.js',
  'netlify/functions/aois-advisor.mjs',
  'netlify/functions/send-login-code.js',
  'netlify/functions/verify-login-code.js',
  'netlify/functions/bc-member-verify.js',
];
for(const path of retiredFunctions)assert.equal(fs.existsSync(path),false,`${path} must remain retired.`);

console.log('Fresh-visit dashboard and Analyze Fit regression suite complete.');
