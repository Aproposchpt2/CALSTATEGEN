# APROPOS PROCUREMENT DATA ACQUISITION SYSTEM (PDAS)

## OFFICIAL EXECUTION ASSIGNMENT

**To:**  
AGENT AZ-8  
PDAS City of Tucson Procurement Acquisition Team

**From:**  
ALEXANDER  
PDAS Project Orchestrator

**Mission status:** AUTHORIZED

---

## Execution identification

**Publisher:** City of Tucson Procurement Department  
**Publisher ID:** `AZ-L1-003`  
**Official procurement website:** City of Tucson Procurement  
**Target production table:** `public.state_contract_opportunities`  
**Binding acquisition standard:** `docs/pdas-contract-intelligence-acquisition-standard.md`

**Execution mode:** Live acquisition, official-document review, requirement extraction, normalization, database write, QA classification, and customer-release determination.

## Mission

Execute a live acquisition scan for every publicly available procurement opportunity issued or administered by the City of Tucson Procurement Department.

This mission is not limited to solicitation metadata. For every discovered opportunity, inspect the official detail page and all reasonably accessible solicitation documents, attachments, addenda, amendments, specifications, forms, notices, and authorized portal records.

Acquire enough evidence to determine:

- what the City of Tucson is purchasing;
- what services must be performed;
- what products and deliverables must be supplied;
- what licenses, certifications, experience, insurance, bonding, staffing, equipment, participation, and submission conditions apply;
- which City entity and department issued the procurement;
- which procurement and technical contacts are published;
- whether the record contains enough evidence for contractor matching.

Normalize supported records and insert or update:

`public.state_contract_opportunities`

A metadata-only row is a discovered record, not a complete Contract Intelligence record.

## Acquisition scope

Acquire all publicly available opportunities and lifecycle updates, including:

- Invitations and Calls for Bid;
- Requests for Proposal, Qualifications, Information, Quotation, and Statements of Qualifications;
- professional services;
- architecture, engineering, and design;
- construction and public works;
- maintenance, repair, installation, rehabilitation, and inspection;
- commodities, equipment, materials, supplies, software, and technology;
- cooperative purchasing;
- revenue contracts and concessions;
- human services;
- transportation and fleet;
- water and wastewater;
- emergency and on-call services;
- addenda, amendments, awards, cancellations, deadline changes, and mandatory meetings.

## Mandatory acquisition behavior

For each opportunity:

1. Identify the official procurement record and stable source identity.
2. Inspect the complete publicly available detail page.
3. Retrieve or enumerate available solicitation documents.
4. Extract the full available description and scope.
5. Extract substantive requirements under the binding PDAS Contract Intelligence Acquisition Standard.
6. Preserve detailed buyer language for Contract DNA matching.
7. Extract issuing-organization, department, jurisdiction, vendor-registration, and official-source information.
8. Extract procurement and technical contacts, including names, roles, emails, and telephone numbers when published.
9. Preserve source document, page or section, confidence, verification state, and timestamp evidence.
10. Normalize and upsert the opportunity without erasing previously verified values when a later source response is incomplete.
11. Assign independent database-ingestion, Contract Intelligence, contact, document, QA, and customer-release determinations.

## Required normalized fields

Populate the existing production fields when evidence is available:

- `pdas_record_id`
- `state_code`
- `jurisdiction_type`
- `jurisdiction_name`
- `issuing_organization`
- `issuing_department`
- `source_platform`
- `source_record_id`
- `source_url`
- `official_source_url`
- `vendor_registration_url`
- `solicitation_number`
- `title`
- `description`
- `procurement_type`
- `notice_type`
- `status`
- `posted_at`
- `response_deadline`
- `prebid_datetime`
- `question_deadline`
- `award_date`
- `place_of_performance_city`
- `place_of_performance_county`
- `place_of_performance_state`
- `estimated_value_min`
- `estimated_value_max`
- `currency`
- `contact_name`
- `contact_email`
- `contact_phone`
- `naics_codes`
- `nigp_codes`
- `unspsc_codes`
- `commodity_codes`
- `set_asides`
- `certifications_required`
- `keywords`
- `document_urls`
- `classifications`
- `requirements`
- `raw_source_payload`
- `amendment_number`
- `amendment_count`
- `acquisition_method`
- `ingestion_run_id`
- `extraction_confidence`
- `data_quality_score`
- `qa_status`
- `qa_notes`

Preserve any additional published contacts and evidence in `raw_source_payload` until dedicated normalized fields are authorized.

## Customer-release determination

A record may be retained for research or enrichment, but it must not be approved for contractor-facing matching unless it satisfies every release control in `PDAS-CIAS-1.0`, including:

- eligible lifecycle status;
- future response deadline;
- valid official or authorized source URL;
- identifiable issuing organization;
- meaningful description, scope, or solicitation evidence;
- at least one substantive requirement;
- positive extraction confidence;
- approved QA status;
- no unresolved critical conflict.

Records failing the standard must be held for enrichment and assigned the applicable QA reason codes. Missing procurement contact information must be disclosed and queued for enrichment, but it does not authorize fabrication.

## Required execution results

Return:

- database count at scan start and completion;
- records discovered, inserted, updated, deduplicated, and closed;
- mission-attributable net growth;
- records with meaningful descriptions and substantive scopes;
- records with substantive requirements;
- records with solicitation documents, addenda, and amendments;
- records with issuing organization and department;
- records with procurement contact name, email, and telephone;
- records with technical contacts;
- records with vendor-registration and official-source URLs;
- records approved for contractor matching;
- records held for enrichment;
- records excluded from contractor-facing release;
- requirement coverage by capability, product, license, certification, set-aside, insurance, bonding, experience, staffing, equipment, emergency response, meeting, submission, evaluation, security, and compliance class.

Return at least five evidence-complete sample records showing title, solicitation number, entity, department, contacts, source, documents, scope, requirements, confidence, and release determination.

## Final determination

Report separately:

- `DATABASE ACQUISITION STATUS: COMPLETE / PARTIAL / FAILED`
- `DATABASE WRITE STATUS: VERIFIED / PARTIAL / FAILED`
- `CONTRACT INTELLIGENCE EXTRACTION STATUS: COMPLETE / PARTIAL / ENRICHMENT REQUIRED`
- `ISSUING-ENTITY EXTRACTION STATUS: COMPLETE / PARTIAL / ENRICHMENT REQUIRED`
- `CONTACT EXTRACTION STATUS: COMPLETE / PARTIAL / NO PUBLIC CONTACTS FOUND`
- `DOCUMENT RETRIEVAL STATUS: COMPLETE / PARTIAL / ACCESS LIMITED`
- `CUSTOMER-RELEASE STATUS: APPROVED / PARTIALLY APPROVED / NOT APPROVED`
- `PDAS PUBLISHER STATUS: AZ-L1-003 ACTIVE / REVIEW REQUIRED / SUSPENDED`

## Execution controls

Execution only.

- Do not alter the production schema unless separately authorized.
- Do not fabricate unavailable procurement information.
- Do not mark unknown requirements as satisfied.
- Do not reduce detailed procurement language to broad category labels.
- Do not release metadata-only records to contractor-facing matching.
- Do not erase previously verified evidence because a later source response is incomplete.
- Preserve official-source evidence, document inventory, addenda, amendment history, reversibility, and ingestion-run attribution.
- Do not claim completion or 100% extraction unless the evidence supports it.

**Mission status:** AUTHORIZED