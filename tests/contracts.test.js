import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateFixture, parseRoute, statuses } from '../src/contracts.js';
const fixture = JSON.parse(await readFile(new URL('../mocks/scenario.json', import.meta.url)));
test('shared fixture covers all four eligibility states and valid references', () => {
  validateFixture(fixture);
  assert.deepEqual(new Set(fixture.results.map(r => r.status)), new Set(Object.keys(statuses)));
  for (const item of [...fixture.questions, ...fixture.documents, ...fixture.schedules]) assert.ok(fixture.policies.some(p => p.policy_id === item.policy_id));
});
test('reject unknown states, missing future dates, evidence and orphan results', () => {
  for (const change of [d => d.results[0].status = 'MAYBE', d => d.results[3].future_eligibility_date = null, d => d.results[0].conditions[0].evidence = null, d => d.results[0].policy_id = 'missing']) {
    const copy = structuredClone(fixture); change(copy); assert.throws(() => validateFixture(copy));
  }
});
test('routes support initial load and policy deep links', () => {
  assert.deepEqual(parseRoute(''), { page: 'results', id: undefined });
  assert.deepEqual(parseRoute('#/policies/demo-4'), { page: 'policies', id: 'demo-4' });
});
