# AOIE State & Local Shadow MVP

## Status

Protected development implementation for NAT-CORP live testing. It does not replace the existing dashboard matcher.

## Approved production data contract

Authoritative opportunity inventory:

- `public.state_contract_opportunities`

Approved enrichment sources:

- `public.pdas_publishers`
- `public.pdas_publisher_platforms`
- `public.pdas_procurement_platforms`

Authentication and limited business-profile fallback only:

- `public.state_alert_subscribers`

Preferred long-term candidate relation:

- `public.aoie_opportunity_candidates_v1`

AOIE remains read-only and separate from procurement acquisition, ingestion, normalization, versioning, amendment processing, and deduplication.

## Source precedence

The endpoint first attempts to read `public.aoie_opportunity_candidates_v1`.

When that relation does not exist, it uses the approved transition fallback:

- `public.state_contract_opportunities`
- PDAS publisher and procurement-platform registry enrichment

The fallback is limited to a missing-relation condition. Other canonical-view failures are surfaced rather than silently masked.

The future canonical view must expose these filter-compatible fields, either directly or through stable aliases:

- `state_code`
- `status`
- `response_deadline`
- `is_latest_version`
- `duplicate_of`
- `posted_at`

It may additionally expose `normalized_status`; AOIE already preserves that value in normalized result output when present.

## Candidate retrieval controls

Candidate retrieval applies these filters before scoring:

- Requested state
- `is_latest_version = true`
- `duplicate_of is null`
- Status in `open`, `upcoming`, `posted`, or `active`
- Response deadline is null or not expired

The response reports the relation used, fallback status, and each applied source control.

## Matching evidence

The state/local AOIE adapter evaluates business capability profiles using:

- Exact UNSPSC alignment
- Exact and related commodity-code alignment
- Business service and product terminology
- Versioned capability-family ontology
- State service area
- Certification and licensing requirements
- Contract-capacity evidence
- Deadline hard constraints

## Registry enrichment

Opportunity-level URLs remain authoritative when present.

When opportunity-level values are absent, AOIE prefers verified registry values in this order:

1. Publisher-platform mapping
2. Procurement-platform registry
3. Publisher registry

Each result includes:

- Publisher identity and organization type
- Registry verification status
- Publisher match method and confidence
- Procurement platform and technology vendor
- Registration and authentication indicators
- Official-source URL provenance
- Vendor-registration URL provenance

## Components

1. `netlify/functions/_shared/aoie-state-local.mjs`
   - Versioned state/local ontology
   - Business profile expansion
   - Opportunity feature extraction
   - Explainable hybrid scoring
   - Hard disqualifiers
   - Production source-contract exports

2. `netlify/functions/_shared/aoie-state-source.mjs`
   - Canonical-view detection
   - Direct-table transition fallback
   - Deadline, version, duplicate, status, and state filters
   - PDAS publisher/platform enrichment
   - Stable public-result normalization

3. `netlify/functions/aoie-state-shadow.mjs`
   - Protected endpoint at `/api/aoie-state-shadow`
   - Accepts an existing NAT-CORP member session or `AOIE_INTERNAL_TOKEN`
   - Uses `state_alert_subscribers` only for authentication and limited fallback
   - Returns source, registry, scoring, and version evidence
   - Performs no database mutation

4. `aoie-lab.html`
   - Authenticated live test interface
   - Uses the current NAT-CORP profile when available
   - Shows score, publisher, platform, URL-provenance, and verification evidence

5. Test suites
   - `tests/aoie-state-local.test.mjs`
   - `tests/aoie-state-source.test.mjs`

## Versions

- Engine: `aoie-state-local-mvp-1`
- Ontology: `state-local-general-v1`
- Scoring: `state-local-hybrid-v1`
- Profile: `state-local-capability-profile-v1`
- Source contract: `aoie-state-local-source-v2`

## Safety boundaries

- Existing dashboard matching remains unchanged.
- The lab is not linked from the public homepage.
- No database schema change is required by PR #7.
- No opportunity or registry record is modified.
- No score is presented as proof of eligibility.
- Full solicitation review remains mandatory before pursuit.
- NGCC remains unchanged.

## Promotion gates

The state/local engine should not replace the existing matcher until:

1. Matcher and source-contract fixtures pass.
2. The Deploy Preview builds successfully.
3. Live session authentication is verified.
4. Direct-table retrieval and registry enrichment are verified against Supabase.
5. At least 20 business profiles are tested.
6. False-positive and false-negative results are reviewed.
7. California and Nevada data coverage is adequate.
8. Licensing and certification detection is calibrated.
9. The Project Owner separately authorizes dashboard integration and production merge.
