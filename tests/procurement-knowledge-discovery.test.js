'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EXTRACTION_VERSION,
  extractOpportunity,
  processRecords,
  buildFrequencyReport,
  removeBoilerplate,
} = require('../scripts/lib/procurement-knowledge');

function record(overrides) {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    pdas_record_id: 'PDAS-test-1',
    source_record_id: 'test:1',
    title: 'Test Opportunity',
    description: '',
    keywords: [],
    certifications_required: [],
    naics_codes: [],
    nigp_codes: [],
    unspsc_codes: [],
    commodity_codes: [],
    classifications: {},
    requirements: {},
    issuing_organization: 'Test Agency',
    source_platform: 'test',
    source_url: 'https://example.gov/opportunity/1',
    is_latest_version: true,
    duplicate_of: null,
    ...overrides,
  };
}

test('Window Systems Repair is physical construction, not information technology', () => {
  const result = extractOpportunity(record({
    title: 'Window Systems Repair - School for the Blind',
    description: 'Demolition, excavation, window replacement, roofing, wiring, and related work. License required to bid the project: B.',
    keywords: ['facility_maintenance', 'construction_general', 'electrical', 'roofing'],
    unspsc_codes: ['72152400'],
  }));
  assert.equal(result.primary_capability.capability_id, 'facilities.window_systems_repair');
  assert.equal(result.capabilities.some(item => item.capability_id.startsWith('information_technology.')), false);
  assert.deepEqual(result.licenses, ['B']);
});

test('Microsoft Windows Server support requires explicit IT evidence', () => {
  const result = extractOpportunity(record({
    title: 'Microsoft Windows Server and Active Directory Support',
    description: 'Provide managed IT services, help desk, patching, and Windows Server administration.',
    keywords: ['it_services'],
  }));
  assert.equal(result.capabilities.some(item => item.capability_id === 'information_technology.windows_platform_support'), true);
  assert.equal(result.capabilities.some(item => item.capability_id === 'facilities.window_systems_repair'), false);
});

test('Product supply remains distinct from installation and maintenance services', () => {
  const result = extractOpportunity(record({
    title: 'HVAC Equipment Supply, Installation, and Maintenance',
    description: 'Supply air handlers and HVAC equipment, install units, and provide preventive maintenance.',
    keywords: ['plumbing_hvac', 'facility_maintenance'],
  }));
  assert.equal(result.products.includes('HVAC equipment'), true);
  assert.equal(result.services.includes('installation'), true);
  assert.equal(result.services.includes('maintenance'), true);
  assert.equal(result.primary_capability.capability_id, 'facilities.hvac_maintenance');
});

test('Generic terminology alone does not create a supported capability', () => {
  const result = extractOpportunity(record({
    title: 'Systems Management Support Services',
    description: 'Provide support and management services.',
    keywords: ['system', 'services', 'support', 'management', 'technology'],
  }));
  assert.equal(result.primary_capability, null);
  assert.equal(result.review_status, 'review_required');
  assert.equal(result.review_reasons.includes('generic_terms_only'), true);
});

test('Boilerplate is suppressed before extraction', () => {
  const cleaned = removeBoilerplate('The Office of Business and Acquisition Services will receive Sealed Bids at 707 Third Street. Click on "Start Search" in the portal. Janitorial services are required.');
  assert.match(cleaned, /Janitorial services/i);
  assert.doesNotMatch(cleaned, /receive sealed bids/i);
});

test('Source provenance and classification assignments are preserved', () => {
  const result = extractOpportunity(record({
    title: 'Cybersecurity Vulnerability Assessment',
    description: 'Perform penetration testing and produce testing results and technical documentation.',
    keywords: ['security_safety'],
    unspsc_codes: ['81111811'],
  }));
  assert.equal(result.extraction_version, EXTRACTION_VERSION);
  assert.equal(result.source.pdas_record_id, 'PDAS-test-1');
  assert.deepEqual(result.classification_codes, [{
    scheme: 'UNSPSC',
    code: '81111811',
    assignment_status: 'official_source_record',
  }]);
  assert.equal(result.deliverables.includes('testing results'), true);
  assert.equal(result.deliverables.includes('technical documentation'), true);
});

test('Only canonical latest records are processed', () => {
  const result = processRecords([
    record({ id: '1' }),
    record({ id: '2', is_latest_version: false }),
    record({ id: '3', duplicate_of: '1' }),
  ]);
  assert.equal(result.records_considered, 3);
  assert.equal(result.records_processed, 1);
  assert.equal(result.records_skipped, 2);
});

test('Frequency analysis counts distinct opportunities, not repeated text', () => {
  const first = extractOpportunity(record({
    id: '1',
    title: 'Janitorial Janitorial Janitorial Services',
    description: 'Custodial cleaning services.',
  }));
  const second = extractOpportunity(record({
    id: '2',
    title: 'Custodial Services',
    description: 'Janitorial services.',
  }));
  const report = buildFrequencyReport([first, first, second]);
  const row = report.capabilities.find(item => item.value === 'facilities.janitorial_services');
  assert.equal(row.distinct_opportunities, 2);
});
