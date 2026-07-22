# AOIS Intelligence Dashboard V1

## Governing Principle

Do not ask, “How do we improve the dashboard?” Ask: “What decisions must the user make, what intelligence must support those decisions, and how should the dashboard guide the user from discovery to action?”

The dashboard is not a bid list. It is the operating surface of the APROPOS Opportunity Intelligence System.

## Primary User Outcomes

The dashboard must help a business owner answer six questions immediately:

1. What opportunities fit my business?
2. Why do they fit?
3. Am I ready to pursue them?
4. What is missing?
5. What should I do next?
6. What is the market telling me about where my business can grow?

## Core Dashboard Zones

### 1. Executive Intelligence Header

Display:

- Business name
- Capability Profile completion
- Current taxonomy version
- Last profile review
- Active geographic coverage
- Business roles
- System status

Primary actions:

- Update Capability Profile
- Review Missing Qualifications
- View Match Methodology

### 2. Decision Summary

Display six decision metrics:

- High-confidence matches
- Pursuit-ready opportunities
- Opportunities requiring action
- Deadlines within seven days
- Capability gaps detected
- New opportunities since last visit

Each metric must be actionable and open a filtered view.

### 3. Recommended Next Actions

AOIS shall produce a prioritized action queue, not generic notices.

Examples:

- Complete insurance information to unlock 14 additional opportunities.
- Confirm service coverage for Clark County.
- Review three high-fit solicitations closing this week.
- Add past performance for commercial landscaping.
- Resolve one low-confidence capability selection.

Each action must include:

- Reason
- Expected benefit
- Urgency
- Estimated effort
- Direct action control

### 4. Opportunity Intelligence Board

The default opportunity card must display:

- Opportunity title
- Issuing organization
- Jurisdiction
- Deadline
- Procurement type
- Match score
- Readiness score
- Confidence band
- Primary matched capability
- Business role compatibility
- Data-quality indicator

Primary card actions:

- Review Opportunity
- Analyze Fit
- Save
- Dismiss
- Begin Pursuit

### 5. Explainable Match Drawer

Every match must explain itself.

Required sections:

- Why this matched
- Supporting capability evidence
- Qualification evidence
- Geographic alignment
- Contract-value alignment
- Business-role compatibility
- Conflicting or missing evidence
- Confidence calculation

The interface must distinguish:

- Match Score: How closely the work aligns with the business
- Readiness Score: How prepared the business is to pursue
- Opportunity Quality Score: How complete and reliable the procurement record is

### 6. Capability Profile Intelligence

Display:

- Selected services
- Selected products
- Business roles
- Verified qualifications
- Unverified claims
- Past performance strength
- Capacity indicators
- Geographic coverage
- Profile confidence

Provide explicit distinctions among:

- Services performed
- Products supplied
- Construction completed
- Professional advice provided
- Equipment rented
- Systems maintained
- Software licensed
- Hybrid supply-and-install capabilities

### 7. Capability Gap Analysis

AOIS should identify missing requirements that materially affect opportunity access.

Examples:

- License
- Certification
- Insurance
- Bonding
- Past performance
- Registration
- Geographic coverage
- Contract capacity

For each gap, show:

- Gap description
- Number of affected opportunities
- Estimated opportunity value when available
- Corrective action
- Confidence

### 8. Market Demand Intelligence

Display demand derived from the procurement corpus:

- Top matched capabilities
- Demand by geography
- Demand trend
- Most active agencies
- Fastest-growing service areas
- Product versus service demand
- Construction versus professional-service demand
- Typical deadline window

This section must help the business decide where to expand, not merely describe historical data.

### 9. Pursuit Pipeline

Stages:

- New Match
- Reviewing
- Saved
- Analyze Fit Complete
- Pursuit Approved
- Proposal in Progress
- Submitted
- Awarded
- Not Pursued
- Lost

Each state change shall generate learning data for AOIS.

### 10. Learning and Feedback

Every user action should produce structured feedback:

- Viewed
- Saved
- Dismissed
- Dismissal reason
- Pursued
- Not pursued reason
- Proposal started
- Submitted
- Awarded
- Lost

Feedback must improve future matching while preserving explainability.

## Navigation Model

Recommended primary navigation:

- Overview
- My Opportunities
- Pursuit Pipeline
- Capability Profile
- Market Intelligence
- Saved
- Account

Administrative or internal functions must not appear in the business dashboard.

## Controlled Pilot Design Rules

1. Build as a preview-first implementation.
2. Do not replace the production dashboard until QA approval.
3. Use live production data only through approved read paths.
4. Do not expose internal confidence formulas or private system metadata.
5. Preserve all existing login and session behavior until the replacement is validated.
6. Every displayed score must be traceable to evidence.
7. Every empty state must recommend a productive next action.
8. Mobile behavior is mandatory, not deferred.
9. Accessibility and keyboard navigation are required.
10. The interface must preserve APROPOS premium navy-and-gold visual standards while using restrained intelligence-status accents.

## V1 Implementation Sequence

### Phase 1 — Preview Shell

Create a non-production preview page with:

- Navigation
- Executive header
- Decision summary
- Recommended next actions
- Opportunity cards
- Explainability drawer
- Capability profile summary

### Phase 2 — Live Read Integration

Connect the preview to:

- Current opportunities
- AOIE taxonomy tables
- Business profile tables
- Opportunity service mappings
- Confidence scores

### Phase 3 — Pilot Profiles

Load representative controlled-pilot profiles for:

- Plumber
- Landscaper
- Security company
- CPA firm
- IT consultant
- Staffing company
- General contractor
- Product distributor
- Manufacturer or reseller
- Hybrid supplier and installer

### Phase 4 — Decision Intelligence

Add:

- Readiness scoring
- Capability gap analysis
- Recommended actions
- Pursuit pipeline

### Phase 5 — QA and Production Decision

Validate:

- Match precision
- Product-service conflicts
- Score explainability
- Mobile usability
- Accessibility
- Session continuity
- Data privacy
- Performance

## Definition of Success

The redesign succeeds when a business owner can open the dashboard and, within sixty seconds, understand:

- The best current opportunity
- Why it fits
- Whether the business is ready
- What action should happen next
- What missing capability would unlock more opportunity

The dashboard must convert procurement data into a decision.