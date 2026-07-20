import assert from 'node:assert/strict';
import {
  buildCandidateQuery,
  buildRegistryIndex,
  enrichOpportunity,
  isMissingCanonicalRelation,
  publicOpportunity,
} from '../netlify/functions/_shared/aoie-state-local.mjs';

function test(name, fn) {
  try { fn(); console.log('PASS', name); }
  catch (error) { console.error('FAIL', name); throw error; }
}

test('candidate retrieval query applies all approved filters', () => {
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

test('public results preserve registry and classification evidence', () => {
  const row = publicOpportunity({ opportunity_id: 'O1', title: 'Electrical Controls', organization_name: 'Public Utility', state_code: 'CA', naics_codes: ['423610'], nigp_codes: ['28500'], publisher_evidence: { registry_verified: true }, procurement_platform_evidence: { platform_name: 'Bonfire' }, source_evidence: { source_relation: 'public.aoie_opportunity_candidates_v1' } });
  assert.deepEqual(row.naics_codes, ['423610']);
  assert.deepEqual(row.nigp_codes, ['28500']);
  assert.equal(row.publisher_evidence.registry_verified, true);
  assert.equal(row.procurement_platform_evidence.platform_name, 'Bonfire');
});

console.log('AOIE state/local source-contract fixture suite complete.');
