# Taxonomy Gap Report and Service Selection Tree Recommendations v1.0

## Executive finding

The validated extraction architecture is not the limiting factor. The principal limitation is that the current controlled engine contains 16 broad capability rules while Catalog Version 1.0 identifies 131 canonical procurement capabilities.

At least **115 catalog capabilities lack a dedicated current capability representation**, and several existing broad rules require separation into more precise lifecycle or domain nodes.

This document recommends taxonomy design only. It does not authorize implementation.

## 1. Required capability separations

### Construction versus maintenance

The taxonomy must distinguish:

- roof replacement from roof maintenance;
- HVAC installation from HVAC maintenance;
- elevator modernization from elevator maintenance;
- fire-alarm installation from fire-alarm monitoring and repair;
- water infrastructure construction from water-treatment operations;
- building renovation from specialized equipment repair.

### Product versus service

The taxonomy must distinguish:

- medical-equipment supply from medical-equipment maintenance;
- equipment supply from installation;
- equipment rental from maintenance;
- software licensing from software implementation;
- protective-clothing supply from rental and laundering service;
- printing products from mailing and fulfillment services.

### Professional service versus physical construction

The taxonomy must distinguish:

- architecture and engineering from construction delivery;
- construction management from general contracting;
- environmental consulting from hazardous-material abatement;
- transportation planning from roadway construction;
- utility locating from utility construction.

### Technology versus physical equipment

The taxonomy must distinguish:

- enterprise software from hardware support;
- software licensing from application maintenance and operations;
- SCADA and operational technology from building automation;
- environmental monitoring equipment from environmental consulting;
- physical access-control systems from cybersecurity services.

### Healthcare versus staffing

The taxonomy must distinguish:

- occupational medical care from temporary staffing;
- medical-director or speech-pathology services from general staff augmentation;
- provider-network administration from clinical care;
- medical-equipment maintenance from medical-supply procurement.

## 2. Source-data gaps

- Source-assigned NAICS: 0 records.
- Source-assigned NIGP: 0 records.
- Source commodity codes: 0 records.
- Source-assigned UNSPSC: 306 of 345 records.
- Distinct observed UNSPSC values: 484.
- Contractor-license codes appear in both requirements and certification fields.
- Source procurement-type values mix normalized categories and source-native labels.
- Some titles are abbreviations or project numbers and require description or attachment review.
- Attachment-only deliverables, technologies, and requirements remain underrepresented.

## 3. Taxonomy nodes requiring merger control

The following concepts are related but must not be merged:

- janitorial services and exterior pressure washing;
- landscape maintenance and tree/vegetation management;
- septic pumping and sewer/storm-drain cleaning;
- environmental consulting and environmental remediation;
- security guards and electronic security systems;
- software implementation and software licensing;
- government office leasing and public concession opportunities;
- grant funding and the contractor capability needed to execute a funded project.

## 4. Service Selection Tree design

### User-facing domains

The Service Selection Tree should present plain-business labels while retaining the canonical internal domain ID:

1. Construction and Building Improvements
2. Facility Maintenance and Operations
3. Professional and Consulting Services
4. Technology and Digital Services
5. Transportation, Fleet, and Logistics
6. Healthcare and Human Services
7. Security and Public Safety
8. Staffing, Training, and Education
9. Products, Supplies, and Equipment
10. Food, Lodging, and Event Services
11. Real Estate and Leasing
12. Funding-Project Capabilities

### Recommended navigation

`User-facing domain → category → capability group → capability → optional sub-capability`

The tree should not expose all 131 capabilities simultaneously. It should use progressive disclosure and search-assisted navigation.

### Lifecycle clarification

After a user selects an asset or subject, the tree should ask what the business actually does:

- supplies or distributes;
- rents or leases;
- installs or constructs;
- designs or consults;
- operates or administers;
- maintains or repairs;
- inspects, tests, or certifies;
- trains or educates;
- transports or stores;
- removes, remediates, or disposes.

This lifecycle question prevents product/service and construction/maintenance collisions.

### Multi-capability support

A business may select multiple capabilities. One capability should be marked primary for profile organization, but all approved capabilities should participate in AOIE matching.

### Explainable mapping

For every user selection, the interface should be able to explain:

- the plain-language selection;
- the canonical capability;
- government buyer terms;
- recognized synonyms;
- related products and services;
- related source-observed UNSPSC codes;
- recommended NAICS families;
- why an opportunity matched.

## 5. Recommended tree-node contract

Each node should contain:

- `node_id`
- `parent_node_id`
- `node_type`
- `canonical_label`
- `user_facing_label`
- `definition`
- `selection_question`
- `government_terms`
- `business_terms`
- `abbreviations`
- `related_capability_ids`
- `lifecycle_actions`
- `products`
- `services`
- `technologies`
- `licenses`
- `certifications`
- `recommended_naics_families`
- `observed_unspsc_codes`
- `confidence`
- `taxonomy_version`
- `review_status`
- `active`

## 6. Search and browse behavior

The optimal model is hybrid:

- keyword and synonym search for users who know their service;
- guided browsing for users who do not know procurement terminology;
- type-ahead suggestions using buyer and business language;
- collision prompts when a term is ambiguous;
- related-capability suggestions after a primary selection;
- no automatic selection based solely on a generic term.

Examples:

- `windows` asks whether the business repairs physical windows or supports Microsoft Windows.
- `staffing` asks whether the business supplies temporary personnel or provides contracted clinical professionals.
- `equipment` asks whether the business supplies, rents, installs, maintains, inspects, or repairs equipment.
- `engineering` distinguishes professional design from construction execution.

## 7. Governance recommendations

1. Approve the 12-domain structure before individual capability activation.
2. Review high-frequency capabilities first.
3. Require one primary hierarchy location per capability.
4. Use cross-references rather than duplicate placement.
5. Version every label, definition, synonym, and code mapping.
6. Preserve original buyer terminology permanently.
7. Require human approval for NAICS and inferred code mappings.
8. Keep low-information opportunities in a research queue.
9. Do not use source keywords as direct production taxonomy assignments.
10. Revalidate the tree after each major state or publisher expansion.

## 8. Readiness determination

The catalog supports design of a controlled Service Selection Tree prototype. It does not authorize production activation, AOIE matching changes, or NAT-CORP interface changes.
