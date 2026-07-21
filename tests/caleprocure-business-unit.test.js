'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  inferBusinessUnitFromDepartment,
  resolveOpportunity,
  resolveSnapshot,
} = require('../scripts/resolve-caleprocure-business-units');

test('maps California Department of Justice aliases to Business Unit 0820', () => {
  assert.equal(inferBusinessUnitFromDepartment('Department of Justice'), '0820');
  assert.equal(inferBusinessUnitFromDepartment('California Department of Justice'), '0820');
  assert.equal(inferBusinessUnitFromDepartment('Unrelated Department'), null);
});

test('builds a canonical DOJ source identity for list-only events', () => {
  const opportunity = resolveOpportunity({
    id: '0000040000',
    department: 'Department of Justice',
    url: 'https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx',
  });
  assert.equal(opportunity.business_unit, '0820');
  assert.equal(opportunity.source_record_id, '0820:0000040000');
});

test('reports DOJ mappings while preserving already-resolved identities', () => {
  const result = resolveSnapshot({
    opportunities: [
      { id: '0000040000', department: 'Department of Justice' },
      { id: '56A0887', department: 'Department of Transportation', business_unit: '2660' },
    ],
  });
  assert.equal(result.resolved, 2);
  assert.equal(result.unresolved, 0);
  assert.equal(result.dojResolved, 1);
  assert.equal(result.payload.opportunities[1].source_record_id, '2660:56A0887');
});
