# Procurement Extraction Data Contract v1.0

## Envelope

```json
{
  "extraction_version": "pkd-1.0.0",
  "taxonomy_version": "aoie-taxonomy-proposal-1.1.0",
  "generated_at": "ISO-8601 timestamp",
  "source_mode": "read_only_json_export",
  "extractions": []
}
```

## Extraction Object

| Field | Type | Required | Description |
|---|---|---:|---|
| `extraction_version` | string | yes | Deterministic extraction ruleset version |
| `taxonomy_version` | string | yes | Proposed taxonomy version used for labels |
| `source` | object | yes | Full source identity and provenance |
| `procurement_purpose` | object | yes | Title, normalized type, multi-capability flag |
| `primary_capability` | object/null | yes | Highest-supported capability |
| `secondary_capabilities` | array | yes | Additional evidence-supported capabilities |
| `services` | string[] | yes | Requested services |
| `products` | string[] | yes | Requested products/equipment/materials/software |
| `technologies` | string[] | yes | Explicit technical environments |
| `deliverables` | string[] | yes | Explicit deliverables |
| `requirements` | string[] | yes | Explicit operational requirements |
| `licenses` | string[] | yes | Explicit license designations |
| `certifications` | string[] | yes | Explicit or source-provided certifications |
| `classification_codes` | object[] | yes | Source-observed codes; never inferred |
| `buyer_terms` | string[] | yes | Exact matched government terminology |
| `terminology` | object | yes | Meaningful and suppressed generic keywords |
| `confidence` | object | yes | Numeric value and governed band |
| `review_status` | enum | yes | `auto_extracted` or `review_required` |
| `review_reasons` | string[] | yes | Reasons requiring human review |
| `provenance` | object | yes | Original source-presence and extraction method |
| `extraction_fingerprint` | string | yes | SHA-256 deterministic fingerprint |

## Capability Object

```json
{
  "capability_id": "facilities.window_systems_repair",
  "domain": "Facilities and Construction",
  "category": "Building Envelope",
  "group": "Windows and Glazing",
  "capability": "Window Systems Repair and Replacement",
  "procurement_type": "construction",
  "score": 12,
  "matches": [
    {"field": "title", "pattern": "window systems? repair"}
  ],
  "synonyms": ["window repair", "window replacement"]
}
```

## Classification Code Object

```json
{
  "scheme": "UNSPSC",
  "code": "72152400",
  "assignment_status": "official_source_record"
}
```

The workstream does not generate inferred NAICS, NIGP, UNSPSC, PSC, or publisher-specific codes. Any future inferred mapping must use a separate `assignment_status` and governance approval.

## Source Provenance Minimums

At least one of these identifiers must be retained:

- `opportunity_id`
- `pdas_record_id`
- `source_record_id`

The extraction must also preserve publisher, platform, source URL, original title, extraction version, taxonomy version, and fingerprint.
