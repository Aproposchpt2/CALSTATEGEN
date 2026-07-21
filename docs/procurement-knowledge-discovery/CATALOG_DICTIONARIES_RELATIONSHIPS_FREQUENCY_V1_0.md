# Procurement Capability Catalog v1.0 — Dictionaries, Relationships, and Frequency

**Corpus:** 345 canonical procurement opportunities  
**Authority:** Research and recommendation only  
**Production activation:** Not authorized

## 1. Buyer terminology dictionary

The following procurement phrases were observed as substantive buyer language. Frequencies count distinct opportunities.

| Buyer terminology | Frequency |
|---|---:|
| Engineering services | 15 |
| Civil engineering | 14 |
| Information technology services | 13 |
| Janitorial | 13 |
| Demolition | 9 |
| Paving | 8 |
| Roofing | 8 |
| Public works | 7 |
| Freight | 6 |
| Concrete | 4 |
| Cleaning services | 3 |
| Renovation | 3 |
| Towing | 3 |
| Enterprise resource planning | 2 |
| Excavation | 2 |
| Personnel services | 2 |
| SaaS | 2 |
| Window systems repair | 2 |
| Architectural and engineering | 1 |
| Bus services | 1 |
| Custodial | 1 |
| Cybersecurity | 1 |
| Electrical engineering | 1 |
| Floor care | 1 |
| Logistics | 1 |
| Medical equipment | 1 |
| Personal protective equipment | 1 |
| Pharmaceuticals | 1 |
| Social services | 1 |
| Software subscriptions | 1 |
| Transportation services | 1 |
| Vehicle rental | 1 |
| Window repair | 1 |
| Window replacement | 1 |

Original procurement language is retained in the terminology CSV files. Canonical terms do not replace source terminology.

## 2. Service frequency

| Service | Distinct opportunities |
|---|---:|
| Maintenance | 105 |
| Repair | 69 |
| Transportation | 65 |
| Installation | 36 |
| Engineering | 31 |
| Inspection | 30 |
| Design | 23 |
| Training | 20 |
| Consulting | 17 |
| Project management | 15 |
| Janitorial services | 13 |
| Landscaping | 13 |
| Systems integration | 3 |
| Staffing | 2 |

These service terms are relationship evidence. Generic terms such as maintenance or installation require an associated product, asset, facility, or capability before they become a complete business capability.

## 3. Product frequency

| Product or equipment class | Distinct opportunities |
|---|---:|
| Vehicles | 36 |
| Computers | 12 |
| HVAC equipment | 4 |
| Construction materials | 3 |
| Networking equipment | 2 |
| Safety equipment | 1 |
| Servers | 1 |
| Software licenses | 1 |
| Telecommunications equipment | 1 |

Product evidence from generated classifications must be corroborated by title, substantive scope, explicit product fields, or source-assigned codes.

## 4. Technology frequency

| Technology | Distinct opportunities |
|---|---:|
| ERP | 2 |
| SaaS | 2 |
| SCADA | 2 |
| Linux | 1 |

Technology frequency is conservative because many platform names appear only in solicitation attachments not yet available to this workstream.

## 5. Deliverable frequency

| Deliverable | Distinct opportunities |
|---|---:|
| Designs | 20 |
| Drawings | 8 |
| Reports | 3 |

Attachment-text integration is required to expand deliverables such as plans, schedules, specifications, testing results, implementation plans, training materials, transition plans, warranties, datasets, and configuration documentation.

## 6. Contractor licenses

The authoritative contractor-license source is `requirements.contractor_license`.

| License | Opportunities |
|---|---:|
| C-10 | 11 |
| C-12 | 5 |
| C-08 | 4 |
| C-39 | 4 |
| C-20 | 3 |
| C-61 | 3 |
| C-16 | 2 |
| C-22 | 2 |
| C-07 | 1 |
| C-13 | 1 |
| C-15 | 1 |
| C-27 | 1 |
| C-31 | 1 |
| C-33 | 1 |
| C-36 | 1 |
| C-38 | 1 |
| C-57 | 1 |
| D-28 | 1 |
| D-40 | 1 |

Forty-five opportunities also store contractor-license codes in `certifications_required`. The catalog treats that as a source-normalization conflict: licenses and certifications must remain separate entities while preserving the original field provenance.

## 7. Set-asides and certifications

| Source set-aside | Opportunities |
|---|---:|
| DVBE | 13 |
| SB | 11 |

Additional corpus terminology indicates DVBE in 14 opportunities, SB in 12, and Microbusiness in 6. These values are eligibility or diversity-program attributes, not technical capabilities.

## 8. Business-role relationships

| Business role | Supporting opportunities |
|---|---:|
| Technician or service provider | 75 |
| Supplier or distributor | 63 |
| Transporter or courier | 60 |
| Inspector or certifier | 37 |
| Architect or engineer | 18 |
| Consultant or advisor | 15 |
| Subcontractor | 13 |
| Healthcare provider | 6 |
| Construction manager | 4 |
| Interpreter or captioner | 4 |
| Project developer or grant recipient | 4 |
| Program administrator or fiscal agent | 3 |
| Security-services provider | 3 |
| Manufacturer or authorized reseller | 2 |
| Prime contractor | 1 |

Role counts are broad relationship signals and are not qualification determinations.

## 9. Recurring procurement combinations

| Relationship bundle | Supporting opportunities |
|---|---:|
| Equipment maintenance + inspection | 53 |
| Equipment supply + installation | 31 |
| Architecture/engineering + construction delivery | 8 |
| Protective clothing + rental/service | 8 |
| Septic or sewer + pumping/cleaning | 8 |
| Water operations + testing/remediation | 6 |
| EV charging + electrical construction | 5 |
| Security monitoring + system maintenance | 5 |
| Software + implementation/support | 5 |
| Towing + impound storage | 5 |
| Training + certification | 4 |
| Printing + mailing/delivery | 3 |
| Environmental investigation + property/legal due diligence | 1 |

## 10. Knowledge Graph relationship types

Catalog Version 1.0 recommends these governed edge types:

- `requires_service`
- `involves_product`
- `uses_technology`
- `produces_deliverable`
- `requires_license`
- `requires_certification`
- `eligible_set_aside`
- `performed_by_role`
- `commonly_purchased_with`
- `installed_by`
- `maintained_by`
- `inspected_by`
- `replaces`
- `broader_than`
- `narrower_than`
- `exact_synonym_of`
- `related_term_of`
- `source_code_observed`
- `recommended_naics_family`

Every edge must retain source-opportunity IDs, supporting-opportunity count, confidence, taxonomy version, and review status.

## 11. Frequency interpretation

A repeated term is not automatically a capability. Frequency must be interpreted with:

1. procurement intent;
2. source field and provenance;
3. product-versus-service context;
4. lifecycle phase such as supply, installation, maintenance, inspection, or replacement;
5. domain context;
6. confidence and supporting-opportunity count.

The catalog therefore uses frequency as evidence, not as an automatic activation rule.
