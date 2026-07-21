'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  inferBusinessUnitFromDepartment,
  deriveUniqueDepartmentMap,
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

test('derives a department mapping only when one verified Business Unit exists', () => {
  const mapping = deriveUniqueDepartmentMap([
    { id: '1', department: 'Department of Rehabilitation', url: 'https://caleprocure.ca.gov/event/5160/1' },
    { id: '2', department: 'Department of Rehabilitation', business_unit: '5160' },
    { id: '3', department: 'Ambiguous Agency', business_unit: '1000' },
    { id: '4', department: 'Ambiguous Agency', business_unit: '2000' },
  ]);
  assert.equal(mapping.get('department of rehabilitation'), '5160');
  assert.equal(mapping.has('ambiguous agency'), false);
});

test('resolves list-only records from an unambiguous verified department mapping', () => {
  const result = resolveSnapshot({
    opportunities: [
      { id: 'S25-33335', department: 'Department of Rehabilitation', url: 'https://caleprocure.ca.gov/event/5160/S25-33335' },
      { id: 'S25-44444', department: 'Department of Rehabilitation', url: 'https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx' },
    ],
  });
  assert.equal(result.resolved, 2);
  assert.equal(result.unresolved, 0);
  assert.equal(result.snapshotMapped, 1);
  assert.equal(result.payload.opportunities[1].source_record_id, '5160:S25-44444');
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
