# PDAS Cal eProcure Acquisition Core

## Production identity

Cal eProcure records use:

- `source_platform = caleprocure`
- `source_record_id = {BUSINESS_UNIT}:{EVENT_ID}`

Event ID alone is not accepted as a safe statewide identity. The synchronization job migrates legacy Event-ID-only rows when the Business Unit becomes known.

## Acquisition flow

1. Open the official CSCR search page in a stateful Playwright context.
2. Discover all `Posted` events from the official result grid.
3. Extract Business Unit evidence from list-row navigation where available.
4. Reverify new, changed, near-deadline, unresolved, or stale events.
5. Follow the official event popup and capture detail fields.
6. Open `View Event Package` within the same browser session.
7. Enumerate public document metadata and classify addenda, Q&A, solicitations, pricing sheets, and awards.
8. Write the source snapshot to `caleprocure.json`.
9. Normalize and upsert verified records into `public.state_contract_opportunities`.

## Change detection

The acquisition snapshot retains:

- list fingerprint
- content fingerprint
- Event Round
- Event Version
- attachment inventory
- first seen
- last seen
- last detail verification
- last material change

A previously detailed event is not considered immutable. It is revisited when its list fingerprint changes, its verification becomes stale, its deadline is within seven days, or its Business Unit/package state is incomplete.

## Safety rules

- Browser cookies and PeopleSoft session state remain isolated per worker.
- Records without a resolved Business Unit are retained in the source snapshot but deferred from production upsert.
- A failed detail or package request does not erase previously verified fields.
- Source disappearance is not treated as cancellation.
- Attachment binaries are not stored in JSONB; `document_urls` contains document metadata and official links/action references.
- Database service credentials remain server-side in GitHub Actions secrets.

## Runtime controls

Default scheduled arguments:

```text
--detail-limit=80
--package-limit=25
--refresh-hours=24
```

The workflow runs every four hours with concurrency protection and unit tests before acquisition.

## Validation

Run locally:

```bash
npm test
node --check scripts/scrape-caleprocure.js
node --check scripts/sync-supabase.js
```
