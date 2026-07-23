import assert from 'node:assert/strict';
import { analyzeText } from '../netlify/functions/business-profile-agent.mjs';

const construction = analyzeText(`
  We are a licensed electrical contractor providing commercial electrical installation,
  preventive maintenance, generator maintenance, building automation, emergency response,
  and EV charging station installation. OSHA 30. DBE certified. Contractor License C-10.
`);
assert.ok(construction.capabilities.includes('Commercial Electrical Installation'));
assert.ok(construction.capabilities.includes('Preventive and Corrective Maintenance'));
assert.ok(construction.capabilities.includes('Generator Installation and Maintenance'));
assert.ok(construction.capabilities.includes('EV Charging Station Installation'));
assert.ok(construction.roles.includes('Specialty Trade Contractor'));
assert.ok(construction.roles.includes('Maintenance Provider'));
assert.ok(construction.certifications.some((value) => /OSHA\s?30/i.test(value)));
assert.ok(construction.certifications.includes('DBE'));
assert.equal(construction.evidence_state,'needs_confirmation');

const technology = analyzeText(`
  Our software vendor and systems integration practice delivers SaaS and cloud services,
  software development, data analytics, cybersecurity, network infrastructure, and managed IT services.
  The company maintains SOC 2 Type 2 and ISO 27001 certification.
`);
assert.ok(technology.capabilities.includes('Software Development'));
assert.ok(technology.capabilities.includes('SaaS and Cloud Services'));
assert.ok(technology.capabilities.includes('Systems Integration'));
assert.ok(technology.capabilities.includes('Cybersecurity'));
assert.ok(technology.roles.includes('Software Vendor'));
assert.ok(technology.roles.includes('Systems Integrator'));
assert.ok(technology.certifications.some((value) => /SOC\s?2/i.test(value)));
assert.ok(technology.certifications.some((value) => /ISO\s?27001/i.test(value)));

const weak = analyzeText('A company profile with no procurement-relevant details.');
assert.equal(weak.evidence_state,'insufficient_evidence');
assert.deepEqual(weak.capabilities,[]);

console.log('Business Profile Agent extraction fixtures complete.');
