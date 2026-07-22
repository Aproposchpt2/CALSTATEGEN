# AOIE Business Capability Profile — Technical Implementation Specification v1.0

Status: CONTROLLED PILOT
Repository: `Aproposchpt2/NAT-CORP-CONTRACT-EXCHANGE`
Feature flag: `AOIE_CAPABILITY_PROFILE_V1`

## Objective
Replace the legacy flat service checklist with a visit-scoped, versioned Business Capability Profile while preserving the current intake → dashboard → Analyze Fit flow and rollback path.

## Architecture

`intake.html` → `capabilities.html` → server-side AOIE profile APIs → `aoie-state-shadow`/AOIE scoring → `dashboard.html` → `analyze-fit.html`

Authoritative opportunity source remains `public.state_contract_opportunities`, enriched by the PDAS publisher/platform registry. AOIE remains read-only against procurement inventory.

## Visit-scoped rule
Every intake begins a new profile. Prior profile selections are never silently restored by email or browser storage. `sessionStorage` may hold the active profile ID for the visit; Supabase retains the profile for audit and pilot analysis.

## Canonical hierarchy
1. Domain
2. Master Category
3. Service/Product Group
4. Specific Capability

Capabilities carry a procurement type: SERVICE, PRODUCT, CONSTRUCTION, PROFESSIONAL_SERVICE, EQUIPMENT_RENTAL, MAINTENANCE, SOFTWARE, or HYBRID.

## Server API contract
- `GET /.netlify/functions/aoie-taxonomy` — active hierarchy and version.
- `POST /.netlify/functions/aoie-create-profile` — create a new visit-scoped profile.
- `POST /.netlify/functions/aoie-resolve-capability` — canonical/synonym/free-text resolution.
- `POST /.netlify/functions/aoie-save-profile` — roles, capabilities, capacity, qualifications and preferences.
- Existing AOIE matching APIs consume the expanded profile adapter.

## Security
All AOIE tables have RLS enabled. Browser clients have no direct table privileges. Writes use server-side Netlify functions with the service role. No service-role key or sensitive qualification identifier is returned to the browser.

## Pilot UX
The `/services` route can redirect to `/capabilities` only when the feature flag is enabled. The builder separates:
- how the business operates (roles),
- what it performs (services/construction/maintenance/software),
- what it sells (products/equipment),
- territory and capacity,
- profile review.

## Matching rules
Profile-based matching adds procurement-type compatibility, canonical capabilities, roles, geography, qualification/capacity constraints, positive evidence and negative evidence. A product/service mismatch receives a material penalty. Results below 55 are suppressed from My Matches during the pilot.

## Rollback
Set `AOIE_CAPABILITY_PROFILE_V1=false` and preserve the current `/services` and legacy profile adapter. Do not delete legacy code until pilot acceptance.

## Acceptance
- Clean profile every visit.
- Four-level taxonomy operational.
- Services and products separated.
- Multiple business roles supported.
- Taxonomy/profile versions retained.
- Low-confidence terms enter review.
- Existing dashboard remains stable.
- Window Systems Repair is suppressed for an IT-only profile.
- Automated tests pass.
