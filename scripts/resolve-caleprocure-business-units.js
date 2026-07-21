'use strict';

/* Resolve known California agency Business Units when the Cal eProcure list
   does not expose a usable event-detail URL. Exact department aliases are
   used so canonical source identities remain deterministic and auditable. */

const fs = require('fs');
const path = require('path');
const {
  normalizeSpace,
  parseEventIdentity,
  buildSourceRecordId,
} = require('./lib/caleprocure-normalize');

const SNAPSHOT_PATH = path.join(__dirname, '..', 'caleprocure.json');

const DEPARTMENT_BUSINESS_UNITS = new Map([
  ['department of justice', '0820'],
  ['california department of justice', '0820'],
  ['department of justice office of the attorney general', '0820'],
  ['california department of justice office of the attorney general', '0820'],
]);

function normalizeDepartmentName(value) {
  return normalizeSpace(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function inferBusinessUnitFromDepartment(department) {
  return DEPARTMENT_BUSINESS_UNITS.get(normalizeDepartmentName(department)) || null;
}

function resolveOpportunity(opportunity) {
  const identity = parseEventIdentity(opportunity.official_url || opportunity.url, opportunity.id);
  const businessUnit = opportunity.business_unit
    || identity.business_unit
    || inferBusinessUnitFromDepartment(opportunity.department);
  const eventId = opportunity.id || identity.event_id || null;

  if (businessUnit) opportunity.business_unit = String(businessUnit);
  if (eventId) opportunity.id = String(eventId);
  opportunity.source_record_id = buildSourceRecordId(opportunity.business_unit, opportunity.id);
  return opportunity;
}

function resolveSnapshot(payload) {
  const opportunities = Array.isArray(payload.opportunities) ? payload.opportunities : [];
  let resolved = 0;
  let unresolved = 0;
  let dojResolved = 0;

  opportunities.forEach(opportunity => {
    const before = opportunity.source_record_id || null;
    resolveOpportunity(opportunity);
    if (opportunity.source_record_id) resolved += 1;
    else unresolved += 1;
    if (!before && opportunity.business_unit === '0820' && opportunity.source_record_id) dojResolved += 1;
  });

  payload.business_unit_resolved_count = resolved;
  payload.business_unit_unresolved_count = unresolved;
  payload.department_mapping_resolved_count = dojResolved;
  payload.department_mapping_resolved_at = new Date().toISOString();
  return { payload, resolved, unresolved, dojResolved };
}

function main() {
  const payload = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const result = resolveSnapshot(payload);
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(result.payload, null, 2));
  console.log('[resolve-caleprocure-business-units] resolved=' + result.resolved
    + ' unresolved=' + result.unresolved + ' doj_mapped=' + result.dojResolved);
}

if (require.main === module) main();

module.exports = {
  inferBusinessUnitFromDepartment,
  resolveOpportunity,
  resolveSnapshot,
};
