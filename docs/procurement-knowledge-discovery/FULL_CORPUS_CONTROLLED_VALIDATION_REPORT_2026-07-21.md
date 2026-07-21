# Procurement Knowledge Discovery

## Full-Corpus Controlled Validation Report

**Project:** APROPOS Opportunity Intelligence Engine  
**Workstream:** Procurement Knowledge Discovery and Taxonomy Intelligence  
**Validation date:** 2026-07-21  
**Extraction version:** `pkd-1.0.0`  
**Taxonomy proposal:** `aoie-taxonomy-proposal-1.1.0`  
**Authorization:** Full-Corpus Controlled Validation  
**Production activation:** Not authorized

---

## 1. Executive determination

The controlled extraction architecture successfully processed the complete canonical procurement inventory without modifying source records, AOIE runtime behavior, the production taxonomy, or the production schema.

The architecture remains technically sound and source-traceable. Full-corpus validation also exposed material taxonomy-coverage and precision limitations that were not visible in synthetic fixtures.

**Current determination:**

- Architecture: **validated**
- Source isolation: **validated**
- Provenance: **validated**
- Full-corpus execution: **completed**
- Production taxonomy readiness: **not ready**
- Production migration: **not authorized**
- AOIE runtime integration: **not authorized**
- PR merge: **not authorized**

The engine requires a correction and expansion cycle before production consideration.

---

## 2. Validation method

The approved deterministic evidence-weighted extraction logic was executed against the live corpus through a database-local, read-only SQL validation form that mirrors the branch engine's:

- canonical-record filter
- title, keyword, description, classification, and requirement evidence weights
- capability exclusions
- primary and secondary capability ranking
- confidence calculation
- review routing
- distinct-opportunity frequency counting

The connected execution environment could not stream the live database corpus into the isolated Node runtime. No service-role credential, write endpoint, temporary table, function, migration, or production deployment was introduced to bypass that boundary.

All database activity used `SELECT` and `EXPLAIN ANALYZE` only.

---

## 3. Corpus execution metrics

| Metric | Result |
|---|---:|
| Source rows considered | 346 |
| Canonical records processed | 345 |
| Records skipped | 1 |
| Records failed | 0 |
| Auto-extracted | 110 |
| Human review required | 235 |
| Auto-extraction coverage | 31.9% |
| Review-routing rate | 68.1% |
| Complete source provenance | 345 of 345 |
| Window Systems records | 2 |
| Window Systems IT false positives | 0 |

### Review reasons

| Reason | Records |
|---|---:|
| No supported capability | 231 |
| Low-information record | 41 |

Some records have more than one review reason.

---

## 4. Confidence distribution

| Confidence band | Records |
|---|---:|
| Highly Verified | 12 |
| High Confidence | 44 |
| Moderate Confidence | 54 |
| Low Confidence | 4 |
| Review Required | 231 |

The confidence mechanism is functioning as designed: unsupported records are prevented from becoming automatic taxonomy evidence.

---

## 5. Primary capability distribution

| Primary capability | Opportunities |
|---|---:|
| Unclassified | 231 |
| General Construction | 39 |
| Engineering Services | 16 |
| Janitorial and Custodial Services | 14 |
| Managed IT Services | 10 |
| Transportation and Logistics Services | 10 |
| HVAC Maintenance and Repair | 9 |
| Window Systems Repair and Replacement | 3 |
| Medical Supplies and Equipment | 3 |
| Software Products and Services | 3 |
| Staffing and Staff Augmentation | 2 |
| Electrical Work | 1 |
| Human Services and Case Management | 1 |
| Computer Hardware | 1 |
| Cybersecurity Services | 1 |
| Training Services | 1 |

### Secondary capability distribution

| Secondary capability | Opportunities |
|---|---:|
| General Construction | 4 |
| Managed IT Services | 3 |
| Transportation and Logistics Services | 2 |
| HVAC Maintenance and Repair | 1 |
| Janitorial and Custodial Services | 1 |
| Computer Hardware | 1 |

---

## 6. Extracted entity metrics

### Services

**14 service types; 442 distinct opportunity assignments**

| Service | Opportunities |
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

### Products

**9 product types; 61 distinct opportunity assignments**

| Product | Opportunities |
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

### Technologies

**4 technology types; 7 distinct opportunity assignments**

| Technology | Opportunities |
|---|---:|
| ERP | 2 |
| SaaS | 2 |
| SCADA | 2 |
| Linux | 1 |

### Deliverables

**3 deliverable types; 31 distinct opportunity assignments**

| Deliverable | Opportunities |
|---|---:|
| Designs | 20 |
| Drawings | 8 |
| Reports | 3 |

### Licenses

Explicit license parsing found:

- C-10: 4 opportunities
- B: 3 opportunities
- C-38: 1 opportunity

### Certifications and source-field contamination

The source `certifications_required` field produced 22 distinct labels and 82 assignments. However, 45 opportunities store contractor-license codes in that certification field. These values must be reclassified as licenses rather than accepted as certification evidence.

---

## 7. Buyer terminology and synonym intelligence

After excluding SQL audit capture artifacts, the validated buyer-language register contains **34 distinct procurement terms**.

Highest-frequency buyer terms include:

| Buyer term | Opportunities |
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

The validation supports **15 synonym recommendation groups**, including:

- Engineering Services: A&E services, professional engineering, engineering consulting
- Janitorial and Custodial Services: custodial services, building cleaning, facility cleaning
- Managed IT Services: IT support, technology support services, managed technology services
- Transportation and Logistics Services: transport services, fleet services, freight and logistics
- Window Systems Repair: window repair, window replacement, glazing services, fenestration work
- Software Products and Services: software licensing, application development, SaaS subscription

All synonyms remain recommendations pending taxonomy governance review.

---

## 8. Capability relationship analysis

Ten capability co-occurrence relationships were observed.

| Relationship | Opportunities |
|---|---:|
| General Construction ↔ Engineering Services | 3 |
| General Construction ↔ Window Systems Repair | 2 |
| Managed IT Services ↔ Software | 2 |
| General Construction ↔ HVAC Maintenance | 1 |
| General Construction ↔ Janitorial Services | 1 |
| Computer Hardware ↔ Cybersecurity | 1 |
| Computer Hardware ↔ Managed IT Services | 1 |
| Cybersecurity ↔ Managed IT Services | 1 |
| Managed IT Services ↔ Transportation | 1 |
| Engineering Services ↔ Transportation | 1 |

Relationships supported by only one opportunity must remain provisional.

---

## 9. Manual quality review

A ten-domain sample was reviewed against source titles, descriptions, requirements, codes, and extracted output.

| Domain | Sample outcome | Determination |
|---|---|---|
| Information Technology | CALNET Managed Cybersecurity Services | Primary capability correct; hardware secondary evidence should be reviewed for code-description leakage |
| Professional Services | Board Administration and Team Development Consulting | Safely unresolved and routed to review; missing general consulting capability |
| Construction | Road Paving, Camp San Luis Obispo | Correct primary capability and service evidence |
| Engineering | State Coastal Conservancy RFQ/I | Correct engineering capability; source procurement type is inconsistent |
| Janitorial | Los Gatos DMV after-hours janitorial | Correct primary capability; incidental landscaping extraction requires evidence-source tightening |
| Healthcare | Medical Equipment Maintenance and Repair | **Material error:** classified as medical products/goods instead of maintenance service |
| Transportation | Freight Shipping and Delivery | Correct primary capability and service extraction |
| Software | WaterTAP cloud SaaS solution | Correct software primary capability; computer-product extraction is questionable |
| Staffing | Biomedical Monitoring personnel services | **Material error:** medical-care personnel context classified as staffing |
| Product Distribution | Protective Clothing and Supplies Rental | Safely unresolved; product-supply and rental taxonomy is missing |

### Accuracy assessment

- Correct primary classifications: 6 of 10
- Correctly unresolved and routed to review: 2 of 10
- Materially incorrect primary classifications: 2 of 10
- Safe outcomes, including correct review routing: 8 of 10

This is a targeted diagnostic sample, not a statistically powered accuracy estimate.

---

## 10. Classification and source-data conflicts

| Conflict | Records |
|---|---:|
| Source procurement type is null | 26 |
| Source procurement type uses noncanonical values | 16 |
| Construction records carrying `it_services` keyword | 9 |
| Goods records carrying `facility_maintenance` keyword | 46 |
| License codes stored in certification field | 45 |
| Medical-equipment maintenance/product collision | 1 |
| Personnel-services healthcare/staffing collision | 1 |
| Records using system/systems | 76 |
| System term without explicit IT evidence | 52 |
| UNSPSC present but descriptive text is low-information | 24 |
| Records without any classification code | 39 |

These findings confirm that source keywords and source procurement-type labels cannot be treated as authoritative capability assignments.

---

## 11. Taxonomy gap analysis

The controlled rule set does not yet cover 235 records under a broad unsupported-pattern audit. The highest-frequency unsupported source keyword groups are:

| Gap indicator | Records |
|---|---:|
| Construction general | 91 |
| Transportation/logistics | 74 |
| Facility maintenance | 58 |
| Security/safety | 55 |
| Paving/concrete | 41 |
| Legal | 32 |
| Printing/publishing | 29 |
| Healthcare | 24 |
| Environmental | 18 |
| Staffing/HR | 16 |
| Food/beverage | 15 |
| Financial/accounting | 13 |
| Computer hardware | 12 |
| IT services | 12 |
| Software | 12 |
| Training/education | 12 |
| Electrical | 10 |
| Marketing/public relations | 9 |
| Professional consulting | 9 |

Source keyword groups are weak evidence only. They identify candidate taxonomy expansion areas but cannot independently activate capabilities.

---

## 12. Required engine corrections

### Priority 0 — precision corrections

1. **Split medical equipment products from medical equipment services**
   - Add `healthcare.medical_equipment_maintenance`.
   - Require supply, purchase, furnish, delivery, or product-list evidence before assigning medical equipment goods.
   - Prefer maintenance/repair service when the title explicitly states maintenance or repair.

2. **Narrow Staffing and Staff Augmentation**
   - Do not assign staffing from `personnel services` alone.
   - Require temporary labor, staff augmentation, recruitment, placement, contingent labor, or workforce-supply context.
   - Exclude medical-care, occupational-health, investigation, and professional-service personnel contexts.

3. **Tighten product extraction evidence sources**
   - Prevent generic classification descriptions from creating unsupported computer, server, or vehicle product assignments.
   - Require title, substantive description, or explicit source product fields for product extraction.

4. **Tighten incidental service extraction**
   - Reduce service extraction from broad source keyword tags and classification JSON.
   - Preserve evidence-source labels for every extracted service.

5. **Separate licenses from certifications**
   - Normalize California contractor-license codes into the license collection.
   - Preserve original source field and record the source-field conflict.

### Priority 1 — taxonomy expansion

Add controlled candidate capabilities for:

- General consulting and advisory services
- Facility maintenance and operations
- Product supply, rental, and distribution
- Protective clothing and operational supplies
- Landscape maintenance
- Tree and vegetation management
- Legal services
- Printing, publishing, and document production
- Environmental services
- Financial and accounting services
- Food and beverage services
- Marketing, communications, and public outreach
- Calibration and metrology services
- Waste management and confidential destruction
- Water and wastewater infrastructure
- Roadway construction and pavement maintenance
- Electric vehicle charging equipment and installation
- Security and safety services

### Priority 2 — source normalization

- Normalize procurement-type values into a controlled vocabulary.
- Treat source keywords as corroborating evidence only.
- Add code-description provenance and assignment status.
- Create explicit conflict flags for source-type, keyword, and code disagreement.

---

## 13. Performance metrics

The complete database-local core scoring pass executed with:

- Planning time: 2.247 ms
- Execution time: 2,766.187 ms
- Canonical records: 345
- Effective core throughput: approximately 124.7 records/second
- Scored record-capability pairs: 127
- Shared read blocks: 0
- Shared written blocks: 0
- Temporary written blocks: 0

The query was CPU-bound by repeated regular-expression evaluation. For production-scale growth, compiled rule structures, pre-normalized evidence text, incremental fingerprints, and candidate-rule narrowing should replace full cross-product evaluation.

---

## 14. Source-provenance confirmation

All 345 processed records retained:

- opportunity UUID
- PDAS record ID
- source record ID
- source platform
- issuing organization
- official or source URL
- source-assigned classification codes
- original title
- original description-presence indicator
- taxonomy and extraction versions

**Provenance verification: 345 of 345 complete.**

---

## 15. Security confirmation

- No source records were inserted, updated, deleted, normalized, or deduplicated.
- No database migration was applied.
- No temporary production tables or functions were created.
- No production taxonomy was activated.
- No service-role credential was exposed or embedded.
- No AOIE, NAT-CORP, Analyze Fit, NGCC, or federal matching behavior was changed.
- PR #12 remains open, draft, and unmerged.

The project-wide Supabase security advisor reports pre-existing informational and warning findings in unrelated schemas and applications. This validation created no new database object or policy, so it introduced no new Procurement Knowledge Discovery advisor finding.

---

## 16. Migration review status

The proposed migration remains unapplied.

Static dependency review previously confirmed:

- PostgreSQL 17.6
- authoritative opportunity and publisher tables available
- `service_role` available
- `gen_random_uuid()` available
- proposed knowledge-table names not currently present

Migration approval remains a separate Project Orchestrator decision after rule corrections and revalidation.

---

## 17. Updated production-readiness determination

### Approved

- Procurement Knowledge Discovery architecture
- Read-only corpus analysis
- Provenance model
- Confidence and review routing
- Frequency methodology
- Window Systems collision control
- Controlled taxonomy research

### Not ready

- Production taxonomy activation
- Automatic publication of extracted capabilities
- Production database migration
- AOIE runtime consumption
- NAT-CORP Service Selection Tree activation
- Branch merge

### Required before production consideration

1. Correct the two material collision rules.
2. Expand capability coverage using evidence-backed rules.
3. Re-run the complete corpus.
4. Repeat the ten-domain manual review.
5. Demonstrate improved precision and materially reduced unsupported coverage.
6. Complete final migration review.
7. Obtain Project Orchestrator approval.

---

## 18. Final status

**Full-Corpus Controlled Validation:** COMPLETE  
**Records processed:** 345  
**Records failed:** 0  
**Source records modified:** 0  
**Database migrations applied:** 0  
**Production taxonomy changes:** 0  
**PR #12:** OPEN / DRAFT / NOT MERGED  
**Production-readiness:** NOT READY — CORRECTION AND EXPANSION CYCLE REQUIRED
