import assert from 'node:assert/strict';
import {
  buildCandidateQuery,
  buildRegistryIndex,
  enrichOpportunity,
  evaluateOpportunityRelease,
  filterReleaseReadyOpportunities,
  hasIdentifiableIssuingEntity,
  hasMeaningfulOpportunityEvidence,
  hasSubstantiveRequirements,
  isMissingCanonicalRelation,
  publicOpportunity,
} from '../netlify/functions/_shared/aoie-state-local.mjs';

function test(name, fn) {
  try { fn(); console.log('PASS', name); }
  catch (error) { console.error('FAIL', name); throw error; }
}

function readyOpportunity(overrides = {}) {
  return {
    id: 'READY',
    title: 'Network infrastructure maintenance and repair',
    description: 'Provide preventive maintenance, inspection, corrective repair, and emergency response for the agency network infrastructure.',
    issuing_organization: 'City of Example',
    issuing_department: 'Information Technology Department',
    official_source_url: 'https://agency.example/opportunity/ready',
    response_deadline: '2026-07-30T17:00:00Z',
    requirements: {
      scope: 'Preventive maintenance, inspection, corrective repair, and emergency response.',
      response_method: 'Electronic submission through the agency procurement portal.',
    },
    extraction_confidence: 0.94,
    qa_status: 'verified',
    ...overrides,
  };
}

test('candidate retrieval query applies all approved acquisition filters', () => {
  const { query, range } = buildCandidateQuery({ states: ['CA', 'NV'], nowIso: '2026-07-20T19:00:00.000Z', canonical: false });
  assert.equal(query.get('state_code'), 'in.(CA,NV)');
  assert.equal(query.get('is_latest_version'), 'eq.true');
  assert.equal(query.get('duplicate_of'), 'is.null');
  assert.equal(query.get('status'), 'in.(open,upcoming,posted,active)');
  assert.match(query.get('or'), /response_deadline\.gte\.2026-07-20/);
  assert.equal(range, '0-999');
});

test('canonical-view absence is detected without masking other failures', () => {
  assert.equal(isMissingCanonicalRelation(404, ''), true);
  assert.equal(isMissingCanonicalRelation(400, '{"code":"PGRST205"}'), true);
  assert.equal(isMissingCanonicalRelation(500, 'database unavailable'), false);
});

test('verified publisher and primary platform enrich an opportunity', () => {
  const index = buildRegistryIndex({
    publishers: [{ publisher_id: 'CA-CITY-001', state_code: 'CA', organization_name: 'City of Sacramento', organization_type: 'City', procurement_search_url: 'https://city.example/bids', research_status: 'verified' }],
    publisherPlatforms: [{ publisher_id: 'CA-CITY-001', platform_id: 'PLANETBIDS', is_primary: true, public_search_url: 'https://pb.example/city', active: true }],
    platforms: [{ platform_id: 'PLANETBIDS', platform_name: 'PlanetBids', technology_vendor: 'PlanetBids', platform_status: 'active' }],
  });
  const enriched = enrichOpportunity({ state_code: 'CA', issuing_organization: 'City of Sacramento', source_platform: 'PlanetBids' }, index);
  assert.equal(enriched.publisher_id, 'CA-CITY-001');
  assert.equal(enriched.publisher_evidence.registry_verified, true);
  assert.equal(enriched.procurement_platform, 'PlanetBids');
  assert.equal(enriched.official_source_url, 'https://pb.example/city');
});

test('opportunity URLs take precedence over registry fallback URLs', () => {
  const index = buildRegistryIndex({ publishers: [{ publisher_id: 'P1', state_code: 'NV', organization_name: 'Clark County', organization_type: 'County', procurement_search_url: 'https://registry.example', research_status: 'verified' }], publisherPlatforms: [], platforms: [] });
  const enriched = enrichOpportunity({ state_code: 'NV', issuing_organization: 'Clark County, Nevada', official_source_url: 'https://opportunity.example/123' }, index);
  assert.equal(enriched.official_source_url, 'https://opportunity.example/123');
  assert.equal(enriched.source_evidence.official_source_url_origin, 'opportunity.official_source_url');
});

test('release gate accepts only evidence-complete future opportunities', () => {
  const now = Date.parse('2026-07-22T12:00:00Z');
  const release = evaluateOpportunityRelease(readyOpportunity(), now);
  assert.equal(release.release_ready, true);
  assert.deepEqual(release.reasons, []);
  assert.deepEqual(release.evidence, {
    issuing_entity: true,
    meaningful_opportunity_evidence: true,
    substantive_requirements: true,
    extraction_confidence: true,
  });
});

test('data quality score is accepted as direct-table confidence evidence', () => {
  const now = Date.parse('2026-07-22T12:00:00Z');
  const release = evaluateOpportunityRelease(readyOpportunity({ extraction_confidence: undefined, data_quality_score: 0.91 }), now);
  assert.equal(release.release_ready, true);
});

test('release gate rejects missing source, deadline, expired, and review-required records', () => {
  const now = Date.parse('2026-07-22T12:00:00Z');
  const rows = [
    readyOpportunity({ id: 'NO-SOURCE', official_source_url: null }),
    readyOpportunity({ id: 'NO-DEADLINE', response_deadline: null }),
    readyOpportunity({ id: 'EXPIRED', response_deadline: '2026-07-01T00:00:00Z' }),
    readyOpportunity({ id: 'REVIEW', qa_status: 'review_required' }),
    readyOpportunity({ id: 'READY', qa_status: 'auto_ingested' }),
  ];
  const filtered = filterReleaseReadyOpportunities(rows, now);
  assert.deepEqual(filtered.accepted.map((row) => row.id), ['READY']);
  assert.equal(filtered.rejected.length, 4);
  assert.equal(filtered.rejection_summary.missing_or_invalid_official_source_url, 1);
  assert.equal(filtered.rejection_summary.missing_or_expired_deadline, 2);
  assert.equal(filtered.rejection_summary.qa_not_release_ready, 1);
});

test('metadata-only and placeholder requirement records are withheld', () => {
  const now = Date.parse('2026-07-22T12:00:00Z');
  const release = evaluateOpportunityRelease(readyOpportunity({
    description: null,
    document_urls: [],
    requirements: {
      response_method: 'See official event package',
      mandatory_prebid: true,
      contractor_license: null,
      prebid_location: 'Comments:',
    },
  }), now);
  assert.equal(release.release_ready, false);
  assert.ok(release.reasons.includes('missing_meaningful_description_scope_or_document'));
  assert.ok(release.reasons.includes('missing_substantive_requirements'));
});

test('mandatory pre-bid evidence counts only when event details are usable', () => {
  const withoutDetails = readyOpportunity({
    description: 'Official event record for a mandatory conference requirement and related submission conditions.',
    requirements: { mandatory_prebid: true, prebid_location: 'Comments:' },
  });
  const withDetails = readyOpportunity({
    description: 'Official event record for a mandatory conference requirement and related submission conditions.',
    requirements: { mandatory_prebid: true, prebid_location: 'City Hall, Procurement Conference Room 2' },
  });
  assert.equal(hasSubstantiveRequirements(withoutDetails), false);
  assert.equal(hasSubstantiveRequirements(withDetails), true);
});

test('issued entity, requirement, and evidence helpers distinguish usable records', () => {
  assert.equal(hasIdentifiableIssuingEntity({ issuing_organization: 'Public Agency' }), false);
  assert.equal(hasIdentifiableIssuingEntity({ issuing_organization: 'City of Tucson' }), true);
  assert.equal(hasMeaningfulOpportunityEvidence({ description: 'Short' }), false);
  assert.equal(hasMeaningfulOpportunityEvidence({ document_urls: [{ url: 'https://agency.example/solicitation.pdf' }] }), true);
  assert.equal(hasSubstantiveRequirements({ certifications_required: ['C-10'] }), true);
  assert.equal(hasSubstantiveRequirements({ requirements: {} }), false);
});

test('missing procurement contact does not fabricate or block otherwise complete release', () => {
  const now = Date.parse('2026-07-22T12:00:00Z');
  const release = evaluateOpportunityRelease(readyOpportunity({ contact_name: null, contact_email: null, contact_phone: null }), now);
  assert.equal(release.release_ready, true);
});

test('public results preserve registry and classification evidence', () => {
  const row = publicOpportunity({ opportunity_id: 'O1', title: 'Electrical Controls', organization_name: 'Public Utility', state_code: 'CA', naics_codes: ['423610'], nigp_codes: ['28500'], publisher_evidence: { registry_verified: true }, procurement_platform_evidence: { platform_name: 'Bonfire' }, source_evidence: { source_relation: 'public.aoie_opportunity_candidates_v1' } });
  assert.deepEqual(row.naics_codes, ['423610']);
  assert.deepEqual(row.nigp_codes, ['28500']);
  assert.equal(row.publisher_evidence.registry_verified, true);
  assert.equal(row.procurement_platform_evidence.platform_name, 'Bonfire');
});

console.log('AOIE state/local source-contract fixture suite complete.');
