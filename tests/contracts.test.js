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
test('reject orphan references in every secondary screen and conflict', () => {
  for (const key of ['questions', 'documents', 'schedules']) {
    const copy = structuredClone(fixture); copy[key][0].policy_id = 'missing';
    assert.throws(() => validateFixture(copy), /정책 참조/);
  }
  for (const change of [d => d.combination.policy_ids.push('missing'), d => d.combination.conflicts[0].policy_ids.push('missing')]) {
    const copy = structuredClone(fixture); change(copy); assert.throws(() => validateFixture(copy), /정책 참조/);
  }
});
test('reject absent or malformed screen containers before rendering', () => {
  for (const key of ['policies', 'results', 'questions', 'documents', 'schedules']) {
    for (const value of [undefined, null, {}, [null]]) {
      const copy = structuredClone(fixture); copy[key] = value;
      assert.throws(() => validateFixture(copy), /Mock 계약/);
    }
  }
  for (const change of [d => d.profile = null, d => d.combination = null, d => d.combination.policy_ids = null, d => d.combination.conflicts = {}, d => d.combination.conflicts = [null], d => d.combination.compatibility = 'toString', d => d.results[0].status = 'constructor', d => d.results[0].conditions = [null]]) {
    const copy = structuredClone(fixture); change(copy); assert.throws(() => validateFixture(copy));
  }
});
test('validate actual calendar dates including leap-year century boundaries', () => {
  for (const value of ['2026-13-99', '2026-00-01', '2026-01-00', '2026-04-31', '2026-02-29', '1900-02-29', '0000-01-01', '2026-2-01']) {
    const copy = structuredClone(fixture); copy.results[3].future_eligibility_date = value;
    assert.throws(() => validateFixture(copy), /날짜/);
  }
  for (const value of ['2028-02-29', '2000-02-29', '2026-04-30']) {
    const copy = structuredClone(fixture); copy.results[3].future_eligibility_date = value;
    assert.doesNotThrow(() => validateFixture(copy));
  }
});
