import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('analyze-fit.html','utf8');
const dashboard=fs.readFileSync('js/aoie-dashboard.js','utf8');
const intake=fs.readFileSync('intake.html','utf8');

const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match=>match[1]).filter(Boolean);
assert.ok(scripts.length,'Analyze Fit page must contain an executable script.');
for(const script of scripts)new Function(script);

const requiredPages=[
  'Executive Decision Summary',
  'Strategic Alignment',
  'Eligibility Review',
  'Capability Evidence Ledger',
  'Competitive Position',
  'Risk Command Center',
  'Executive Observations',
  'Bid / No-Bid Decision',
  'Executive Action Plan',
  'Management Authorization & Source Notes'
];
for(const title of requiredPages)assert.ok(html.includes(title),`Missing report section: ${title}`);
assert.ok(html.includes('const total=11'),'Premium report must remain an 11-page controlled dossier.');
assert.ok(html.includes('/api/analyze-fit-state'),'Premium renderer must use the state/local assessment endpoint.');
assert.ok(dashboard.includes("/services.html?mode=update"),'Update My Services must return to the service selector.');
assert.ok(!dashboard.includes("location.href='/login.html"),'Dashboard controls must not restore a login gate.');
assert.ok(intake.includes("location.replace('/welcome.html')"),'Retired PDF intake must route to the standard business intake.');
assert.ok(!intake.includes('type="file"'),'Retired PDF intake must not expose a file control.');

console.log('Premium Analyze Fit and dashboard-control regression suite complete.');
