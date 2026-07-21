# Procurement Knowledge Source-Provenance Standard v1.0

Every discovery, relationship, frequency row, and taxonomy recommendation must be reproducible from distinct source opportunities.

## Required Provenance

- opportunity UUID
- PDAS record ID
- source record ID
- solicitation number when available
- issuing organization
- source platform
- official source URL or source URL
- original title
- original description-presence flag
- observed classification codes
- source content fingerprint when available
- extraction method
- extraction version
- taxonomy version
- extraction timestamp
- confidence score and band
- review status

## Prohibited Provenance Practices

- creating normalized terms without supporting source opportunities
- replacing original buyer language with only canonical terminology
- counting repeated text within one opportunity as multiple observations
- treating agency names as capabilities
- treating boilerplate as purchasing demand
- inferring classification codes without explicit labeling and approval
- merging duplicate or superseded versions into frequency counts

## Frequency Rule

Frequency equals the count of distinct canonical latest opportunities supporting the item or relationship.

## Relationship Rule

Every relationship must retain:

- relationship type
- source capability
- target capability
- distinct opportunity frequency
- supporting opportunity IDs
- geographic scope
- publisher scope
- first observed date
- last observed date
- taxonomy version
- confidence
