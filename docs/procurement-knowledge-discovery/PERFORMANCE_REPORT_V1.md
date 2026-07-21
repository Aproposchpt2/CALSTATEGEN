# Procurement Knowledge Discovery Performance Report v1.0

## Scope

This report measures the deterministic extraction engine independently from database/network latency. It does not represent a production corpus run and does not authorize production deployment.

## Environment

- Runtime: Node.js 22.16
- Extraction version: `pkd-1.0.0`
- Taxonomy proposal: `aoie-taxonomy-proposal-1.1.0`
- Execution mode: in-memory, single process, deterministic rules

## Automated QA Runtime

The eight required QA fixtures completed successfully in approximately 188 milliseconds.

| Metric | Result |
|---|---:|
| Tests | 8 |
| Passed | 8 |
| Failed | 0 |
| Skipped | 0 |

## Synthetic Throughput Benchmark

A 10,000-record synthetic benchmark was executed using representative records for:

- physical window-system construction
- Microsoft Windows platform support
- HVAC product/service combinations
- janitorial services
- cybersecurity assessment

| Metric | Result |
|---|---:|
| Records considered | 10,000 |
| Records processed | 10,000 |
| Elapsed time | 1,341.34 ms |
| Throughput | 7,455.21 records/second |
| Processing failures | 0 |

## Interpretation

The deterministic extraction logic is not the likely operational bottleneck for the current 345-record canonical corpus. Production runtime will instead be influenced by:

- database export/query latency
- attachment retrieval and text availability
- document parsing
- review-queue persistence
- audit logging
- relationship aggregation

## Limitations

- The benchmark used synthetic records, not the full live corpus export.
- It did not include PDF or attachment parsing.
- It did not include Supabase writes.
- It did not measure concurrent execution.
- It did not test an AOIE runtime integration.

## Performance Determination

**ENGINE PERFORMANCE: ACCEPTABLE FOR CONTROLLED PILOT REVIEW**

**PRODUCTION PERFORMANCE: NOT YET DETERMINED**
