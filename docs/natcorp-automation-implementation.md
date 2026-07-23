# NAT-CORP Automation Core

This implementation adds the focused five-agent daily workflow authorized for NAT-CORP. It preserves the existing visitor intake, in-memory Business DNA handoff, AOIE matching endpoint, PDAS canonical opportunity inventory, and existing PIEE document infrastructure.

## Runtime entry points

- `/natcorp-command` — internal Command Center
- `/api/natcorp-daily-operations` — create, inspect, and resume a daily run
- `natcorp-daily-operations-background` — sequential resumable orchestrator
- Five internal server-side agent functions
- `/api/natcorp-feedback` — insert-only optional customer survey endpoint
- `/dashboard` — existing dashboard response with the survey component injected

## Operational controls

- One active daily run at a time
- Deterministic idempotency key for each run/agent stage
- Three attempts per agent job
- Every requested/completed stage recorded in `natcorp_workflow_events`
- Explicit failure status and error capture
- No privileged credentials in browser assets
- Public feedback can be inserted but not read under RLS

## Acquisition scope

The acquisition agent executes only deployed and registered snapshot-backed connectors already present in this repository: PlanetBids, Cal eProcure, and OBAS. Publisher-specific or disabled runtimes are reported rather than simulated.

## Test command

```bash
npm test
```
