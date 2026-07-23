export const SOURCE_OF_TRUTH = Object.freeze({
  document: 'APROPOS PROCUREMENT INTELLIGENCE REPORT',
  version: '1.0',
  executionDate: '2026-07-22',
  standard: 'APROPOS-PIR-1.0-ANALYZE-FIT',
  authority: 'ALEXANDER — PDAS Project Orchestrator',
  governingParts: ['Part 10 — Contract DNA Version 1.0','Part 11 — Business DNA Recommendations','Part 12 — AOIE Matching Model','Part 13 — Contract Intelligence Report Recommendations','Part 14 — Opportunity Advisor Recommendations','Appendix A — Canonical Requirement Register']
});

export const REQUIREMENT_CATALOG = Object.freeze([
  {"id":"REQ-CAP-001","class":"Capability","name":"Construction capability"},
  {"id":"REQ-CAP-002","class":"Capability","name":"Maintenance capability"},
  {"id":"REQ-CAP-003","class":"Capability","name":"Repair or rehabilitation capability"},
  {"id":"REQ-CAP-004","class":"Capability","name":"Installation or replacement capability"},
  {"id":"REQ-CAP-005","class":"Capability","name":"Architecture, design, or engineering capability"},
  {"id":"REQ-CAP-006","class":"Capability","name":"Professional or consulting services capability"},
  {"id":"REQ-CAP-007","class":"Capability","name":"Project, program, or construction management capability"},
  {"id":"REQ-CAP-008","class":"Capability","name":"Training, instruction, or workforce development capability"},
  {"id":"REQ-CAP-009","class":"Capability","name":"Inspection, testing, monitoring, or quality-assurance capability"},
  {"id":"REQ-CAP-010","class":"Capability","name":"Emergency, on-call, or rapid-response capability"},
  {"id":"REQ-CAP-011","class":"Capability","name":"Information technology, software, data, or systems capability"},
  {"id":"REQ-CAP-012","class":"Capability","name":"Security services or security-system capability"},
  {"id":"REQ-CAP-013","class":"Capability","name":"Transportation, fleet, transit, or logistics capability"},
  {"id":"REQ-CAP-014","class":"Capability","name":"Environmental, sustainability, or remediation capability"},
  {"id":"REQ-CAP-015","class":"Capability","name":"Healthcare, medical, behavioral-health, or laboratory capability"},
  {"id":"REQ-CAP-016","class":"Capability","name":"Legal, investigative, or compliance advisory capability"},
  {"id":"REQ-CAP-017","class":"Capability","name":"Printing, publishing, mailing, or document-production capability"},
  {"id":"REQ-CAP-018","class":"Capability","name":"Facilities, building systems, or HVAC capability"},
  {"id":"REQ-CAP-019","class":"Capability","name":"Water, wastewater, stormwater, or utility capability"},
  {"id":"REQ-CAP-020","class":"Capability","name":"Roadway, paving, traffic, or civil-infrastructure capability"},
  {"id":"REQ-COM-001","class":"Compliance","name":"Legal, regulatory, policy, or specification compliance"},
  {"id":"REQ-COM-002","class":"Compliance","name":"Safety program or occupational-safety compliance"},
  {"id":"REQ-COM-003","class":"Compliance","name":"Accessibility or nondiscrimination compliance"},
  {"id":"REQ-DAT-001","class":"Information governance","name":"Data security, privacy, confidentiality, or records protection"},
  {"id":"REQ-DEL-001","class":"Performance","name":"Delivery, distribution, or fulfillment requirement"},
  {"id":"REQ-ELG-001","class":"Eligibility","name":"Contractor or professional license"},
  {"id":"REQ-ELG-002","class":"Eligibility","name":"Prequalification or qualified-firm status"},
  {"id":"REQ-ELG-003","class":"Eligibility","name":"Relevant experience or past performance"},
  {"id":"REQ-ELG-004","class":"Eligibility","name":"Required certification or credential"},
  {"id":"REQ-ELG-005","class":"Eligibility","name":"Small, disadvantaged, minority, veteran, or local business participation"},
  {"id":"REQ-ELG-006","class":"Eligibility","name":"Insurance coverage"},
  {"id":"REQ-ELG-007","class":"Eligibility","name":"Bid security, bonding, or surety"},
  {"id":"REQ-ELG-008","class":"Eligibility","name":"Background, security, or clearance qualification"},
  {"id":"REQ-EVA-001","class":"Evaluation","name":"Qualifications, experience, and technical evaluation"},
  {"id":"REQ-EVA-002","class":"Evaluation","name":"Best-value, cost, or award-basis evaluation"},
  {"id":"REQ-FIN-001","class":"Commercial","name":"Price, cost, budget, rate, or financial-capacity requirement"},
  {"id":"REQ-GEO-001","class":"Performance","name":"Place-of-performance, service-area, or location requirement"},
  {"id":"REQ-PAR-001","class":"Delivery model","name":"Subcontracting, teaming, supplier, or participation plan"},
  {"id":"REQ-PER-001","class":"Performance","name":"Staffing, personnel, labor, or key-person requirements"},
  {"id":"REQ-PRD-001","class":"Product","name":"Equipment supply, lease, or support"},
  {"id":"REQ-PRD-002","class":"Product","name":"Materials, commodities, or general supplies"},
  {"id":"REQ-PRD-003","class":"Product","name":"Vehicles, fleet units, parts, or automotive products"},
  {"id":"REQ-PRD-004","class":"Product","name":"Software license, subscription, or technology product"},
  {"id":"REQ-PRE-001","class":"Pre-solicitation","name":"Mandatory pre-bid, pre-proposal, or pre-submittal meeting"},
  {"id":"REQ-PRE-002","class":"Pre-solicitation","name":"Site visit or location inspection"},
  {"id":"REQ-QLT-001","class":"Performance","name":"Quality-control, quality-assurance, warranty, or acceptance requirement"},
  {"id":"REQ-REP-001","class":"Performance","name":"Reporting, documentation, records, or deliverable requirement"},
  {"id":"REQ-SUB-001","class":"Submission","name":"Electronic submission or designated submission system"},
  {"id":"REQ-SUB-002","class":"Submission","name":"Vendor registration or portal account"},
  {"id":"REQ-SUB-003","class":"Submission","name":"Response deadline compliance"},
  {"id":"REQ-SUB-004","class":"Submission","name":"Question deadline compliance"},
  {"id":"REQ-SUB-005","class":"Submission","name":"Addenda/amendment monitoring and acknowledgement"},
  {"id":"REQ-SUB-006","class":"Submission","name":"Required forms, attachments, or supporting documents"},
  {"id":"REQ-TIM-001","class":"Performance","name":"Schedule, completion, response-time, or contract-term requirement"}
]);

export const BUYER_INTENTS = Object.freeze([
  {id:'INT-001',name:'Maintain or extend the life of existing assets'},
  {id:'INT-002',name:'Construct, improve, or modernize public infrastructure'},
  {id:'INT-003',name:'Acquire equipment, vehicles, materials, or supplies'},
  {id:'INT-004',name:'Obtain specialized professional, design, or advisory expertise'},
  {id:'INT-005',name:'Protect public safety, security, or operational resilience'},
  {id:'INT-006',name:'Operate or support an ongoing public program or service'},
  {id:'INT-007',name:'Modernize technology, software, data, or communications'},
  {id:'INT-008',name:'Meet environmental, regulatory, or sustainability obligations'},
  {id:'INT-009',name:'Improve transportation, mobility, fleet, or logistics'},
  {id:'INT-010',name:'Deliver health, human, housing, education, or community services'},
  {id:'INT-011',name:'Develop workforce capability through training or instruction'},
  {id:'INT-012',name:'Secure competitive price, cost control, or best value'},
  {id:'INT-013',name:'Establish a qualified vendor pool or prequalified roster'},
  {id:'INT-014',name:'Respond to urgent, emergency, or time-sensitive need'},
  {id:'INT-015',name:'Satisfy supplier-diversity or local economic participation goals'}
]);

export const HARD_GATES = Object.freeze([
  {id:'GATE-LIFECYCLE',name:'Opportunity lifecycle and deadline feasibility',unknown:'Unknown status lowers confidence; a verified passed deadline blocks pursuit.'},
  {id:'GATE-GEOGRAPHY',name:'Geographic serviceability',unknown:'Unknown service area requires clarification and remains conditional.'},
  {id:'GATE-CREDENTIALS',name:'License and certification eligibility',unknown:'Unknown credentials cannot be marked eligible.'},
  {id:'GATE-PARTICIPATION',name:'Set-aside and participation eligibility',unknown:'Unknown eligibility remains conditional; identify lawful teaming paths separately.'},
  {id:'GATE-MEETING',name:'Mandatory meeting or site visit',unknown:'A verified missed mandatory past event blocks pursuit.'},
  {id:'GATE-ASSURANCE',name:'Insurance, bonding, and surety',unknown:'Unknown is conditional; an explicit unattainable deficiency blocks pursuit.'},
  {id:'GATE-SECURITY',name:'Security, clearance, and background requirements',unknown:'Unknown remains conditional.'},
  {id:'GATE-SUBMISSION',name:'Registration, account, forms, platform, and submission prerequisites',unknown:'Unknown is an operational risk, not automatic failure.'},
  {id:'GATE-CAPACITY',name:'Capacity and contract-scale feasibility',unknown:'Apply only when the opportunity supplies an explicit threshold or reliable scale evidence.'}
]);

export const FIT_FACTORS = Object.freeze([
  {id:'FIT-CAPABILITY',name:'Canonical capability alignment',weight:28},
  {id:'FIT-SCOPE',name:'Service and product scope alignment',weight:20},
  {id:'FIT-SEMANTIC',name:'Procurement-language semantic similarity',weight:15},
  {id:'FIT-REQUIREMENTS',name:'Requirement satisfaction evidence',weight:15},
  {id:'FIT-DELIVERY',name:'Delivery and geographic fit',weight:8},
  {id:'FIT-CAPACITY',name:'Capacity and contract-scale fit',weight:6},
  {id:'FIT-EXPERIENCE',name:'Past performance and experience',weight:4},
  {id:'FIT-INTENT',name:'Buyer-intent alignment',weight:2},
  {id:'FIT-PREFERENCE',name:'User preferences',weight:2}
]);

export const CONFIDENCE_FACTORS = Object.freeze([
  {id:'CONF-SOURCE',name:'Opportunity source completeness',weight:30},
  {id:'CONF-EXTRACTION',name:'Requirement extraction confidence',weight:25},
  {id:'CONF-PROFILE',name:'Business profile completeness',weight:20},
  {id:'CONF-PROVENANCE',name:'Evidence provenance and recency',weight:15},
  {id:'CONF-CONSISTENCY',name:'Cross-source and classification consistency',weight:10}
]);

export const LANGUAGE_RULES = Object.freeze([
  {term:'RFQ',rule:'Resolve as Request for Qualifications or Request for Quote from notice type, neighboring words, forms, evaluation basis, and agency convention. Never expand blindly.'},
  {term:'license',rule:'Distinguish contractor/professional credentials from software licenses by object and context.'},
  {term:'security',rule:'Separate protective services, physical systems, cybersecurity, and clearance eligibility.'},
  {term:'maintenance',rule:'Identify the maintained object and distinguish facility, equipment, software, and recurring service contexts.'},
  {term:'repair',rule:'Preserve corrective repair, rehabilitation, restoration, remediation, and replacement as narrower concepts.'},
  {term:'water',rule:'Distinguish utility infrastructure, treatment, commodity, environmental resource, and delivery contexts.'},
  {term:'qualified',rule:'Distinguish solicitation type, bidder eligibility, staff qualification, and evaluation judgment.'},
  {term:'service',rule:'Treat as nondiscriminative unless paired with an object, outcome, or activity.'}
]);

export const REQUIREMENT_IDS = new Set(REQUIREMENT_CATALOG.map(item=>item.id));
export const HARD_GATE_IDS = new Set(HARD_GATES.map(item=>item.id));
export const FIT_FACTOR_IDS = new Set(FIT_FACTORS.map(item=>item.id));
export const CONFIDENCE_FACTOR_IDS = new Set(CONFIDENCE_FACTORS.map(item=>item.id));

export function sourceOfTruthPrompt() {
  const requirements=REQUIREMENT_CATALOG.map(item=>`${item.id} | ${item.class} | ${item.name}`).join('\n');
  const intents=BUYER_INTENTS.map(item=>`${item.id} | ${item.name}`).join('\n');
  const gates=HARD_GATES.map(item=>`${item.id} | ${item.name} | Unknown rule: ${item.unknown}`).join('\n');
  const fit=FIT_FACTORS.map(item=>`${item.id} | ${item.name} | ${item.weight} points`).join('\n');
  const confidence=CONFIDENCE_FACTORS.map(item=>`${item.id} | ${item.name} | ${item.weight} points`).join('\n');
  const language=LANGUAGE_RULES.map(item=>`${item.term}: ${item.rule}`).join('\n');
  return `AUTHORITATIVE SOURCE OF TRUTH
Document: ${SOURCE_OF_TRUTH.document}
Version: ${SOURCE_OF_TRUTH.version}
Standard: ${SOURCE_OF_TRUTH.standard}

NON-NEGOTIABLE CONTRACT DNA RULES
- Every material factor must have evidence_state = KNOWN, UNKNOWN, NOT_APPLICABLE, or CONFLICTING.
- Missing text is UNKNOWN, never false.
- Every derived conclusion must identify the evidence used and the applicable requirement IDs.
- Separate observed opportunity facts, reported business facts, normalized findings, semantic inferences, and recommendations.
- Do not use NAICS as a match dimension. UNSPSC may corroborate but may not override requirements, scope, capability, product, or semantic evidence.

MATCH OUTCOMES
- INELIGIBLE: a verified hard constraint fails.
- CONDITIONALLY_ELIGIBLE: no verified failure, but one or more applicable hard constraints are unknown or unresolved.
- ELIGIBLE_STRONG_MATCH: known gates pass and the fit is strong.
- ELIGIBLE_PARTIAL_MATCH: known gates pass but scope or capability evidence is moderate or incomplete.
- INSUFFICIENT_EVIDENCE: the opportunity or business profile is too incomplete for a reliable determination.

HARD GATES
${gates}

FIT SCORE FACTORS — TOTAL 100
${fit}

CONFIDENCE SCORE FACTORS — TOTAL 100
${confidence}

CANONICAL REQUIREMENT REGISTER
${requirements}

BUYER INTENT REGISTER
${intents}

CONTEXT AND AMBIGUITY RULES
${language}

REPORT INTENT
The intended result is a decision-grade Contract Intelligence Report that separately shows eligibility, fit, confidence, requirement evidence, missing business evidence, missing opportunity evidence, disqualifying conditions, operational risks, delivery/scale assessment, buyer questions, and next actions. The Opportunity Advisor may ask only evidence-driven questions generated from unresolved Contract DNA or Business DNA factors.`;
}
