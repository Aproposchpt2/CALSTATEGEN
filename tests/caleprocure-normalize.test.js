'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseCaliforniaDate,
  parseEventIdentity,
  buildSourceRecordId,
  extractSolicitationNumber,
  extractQuestionDeadline,
  extractSetAsides,
  extractCertifications,
  normalizeStatus,
} = require('../scripts/lib/caleprocure-normalize');

test('parses PDT close dates into UTC', () => {
  assert.equal(parseCaliforniaDate('07/20/2026\n10:00AM PDT'), '2026-07-20T17:00:00.000Z');
});

test('parses PST dates into UTC', () => {
  assert.equal(parseCaliforniaDate('12/15/2026 10:30AM PST'), '2026-12-15T18:30:00.000Z');
});

test('infers California daylight time when zone is omitted', () => {
  assert.equal(parseCaliforniaDate('07/20/2026 10:00AM'), '2026-07-20T17:00:00.000Z');
});

test('parses clean and PeopleSoft event identities', () => {
  assert.deepEqual(parseEventIdentity('https://caleprocure.ca.gov/event/2660/56A0887'), {
    business_unit: '2660',
    event_id: '56A0887',
  });
  assert.deepEqual(parseEventIdentity('https://example.test?BUSINESS_UNIT=5160&AUC_ID=S25-33335'), {
    business_unit: '5160',
    event_id: 'S25-33335',
  });
});

test('builds the approved Business Unit and Event ID source key', () => {
  assert.equal(buildSourceRecordId('2660', '56A0887'), '2660:56A0887');
  assert.equal(buildSourceRecordId(null, '56A0887'), null);
});

test('extracts common California solicitation numbers', () => {
  assert.equal(
    extractSolicitationNumber('Shop Clothing Linen Services', 'Invitation for Bids (IFB) Number 26C155003 entitled services.'),
    '26C155003',
  );
  assert.equal(
    extractSolicitationNumber('Project', 'RFP No. S25-33335 seeks qualified providers.'),
    'S25-33335',
  );
});

test('extracts question deadlines from narrative text', () => {
  assert.equal(
    extractQuestionDeadline('All questions must be submitted no later than 10:00 AM PST, July 7, 2026.'),
    '2026-07-07T18:00:00.000Z',
  );
});

test('extracts preference and certification requirements', () => {
  assert.deepEqual(extractSetAsides('DVBE Goals apply. SB Incentive applies.'), ['SB', 'DVBE']);
  assert.ok(extractCertifications("Contractor must possess a C16 Fire Protection Contractor's License.").includes('C16'));
});

test('normalizes explicit source statuses', () => {
  assert.equal(normalizeStatus('Cancelled', '2099-01-01T00:00:00.000Z'), 'cancelled');
  assert.equal(normalizeStatus('Pending Award', null), 'pending_award');
  assert.equal(normalizeStatus('Posted', '2099-01-01T00:00:00.000Z'), 'open');
  assert.equal(normalizeStatus('Posted', '2020-01-01T00:00:00.000Z'), 'closed');
});
