'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fromCalEprocure, normalizeRow } = require('../scripts/sync-supabase');

test('maps a verified Cal eProcure event to the PDAS source identity and schema', () => {
  const row = fromCalEprocure({
    id: '56A0887',
    business_unit: '2660',
    title: 'Asset Data Collection-North',
    department: 'Department of Transportation',
    status: 'Posted',
    close_date: '2099-07-20T20:00:00.000Z',
    published_date: '2099-06-08T20:00:00.000Z',
    description: 'RFP No. 56A0887 for software data collection. DVBE Goals apply.',
    solicitation_number: '56A0887',
    bid_type: 'Sell Event / RFx',
    detail_fetched: true,
    package_fetched: true,
    event_round: 1,
    event_version: 2,
    unspsc_codes: [{ code: '43211718', description: 'Camera systems' }],
    set_asides: ['DVBE'],
    certifications_required: [],
    concept_tags: ['software'],
    document_urls: [{ filename: 'RFP.pdf', document_type: 'solicitation', official_url: 'https://example.test/RFP.pdf' }],
    url: 'https://caleprocure.ca.gov/event/2660/56A0887',
    official_url: 'https://caleprocure.ca.gov/event/2660/56A0887',
    first_seen_at: '2099-06-08T20:00:00.000Z',
    last_seen_at: '2099-06-09T20:00:00.000Z',
    last_detail_fetched_at: '2099-06-09T20:00:00.000Z',
    content_fingerprint: 'abc123',
  });

  assert.equal(row.source_record_id, '2660:56A0887');
  assert.equal(row.source_platform, 'caleprocure');
  assert.equal(row.status, 'open');
  assert.equal(row.procurement_type, 'information_technology');
  assert.deepEqual(row.unspsc_codes, ['43211718']);
  assert.equal(row.amendment_count, 1);
  assert.equal(row.classifications.event_version, 2);
  assert.equal(row.document_urls.length, 1);
  assert.ok(row.source_fingerprint);
});

test('refuses unsafe Cal eProcure identities without a Business Unit', () => {
  assert.equal(fromCalEprocure({ id: '0000039663', title: 'Test' }), null);
});

test('normalization omits unknown nulls so an incomplete parser cannot erase valid data', () => {
  const row = normalizeRow({
    state_code: 'CA',
    title: 'Example',
    description: null,
    qa_notes: null,
    unspsc_codes: [],
  });
  assert.equal(Object.hasOwn(row, 'description'), false);
  assert.equal(Object.hasOwn(row, 'qa_notes'), true);
  assert.deepEqual(row.unspsc_codes, []);
});
