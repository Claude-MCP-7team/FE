import test from 'node:test';
import assert from 'node:assert/strict';
import { createPoliciesApi } from '../src/policies-api.js';

const page = (items, total, offset) => ({ ok: true, status: 200, json: async () => ({ snapshot_version: 'v1', total, limit: items.length, offset, items }) });
const item = (policy_id, overrides = {}) => ({ policy_id, title: `정책 ${policy_id}`, apply_start: '2026-09-01', apply_end: '2026-09-30', is_rolling: false, amount_krw: null, estimated_total_krw: 100000, amount_confidence: 'ESTIMATED', ...overrides });

test('fetches a single page and normalizes fields', async () => {
  let request;
  const api = createPoliciesApi({ baseUrl: 'https://be.test/', fetchImpl: async (url, options) => { request = { url, options }; return page([item('P1'), item('P2', { amount_krw: 50000, estimated_total_krw: null })], 2, 0); } });
  const items = await api.list();
  assert.equal(request.url, 'https://be.test/v1/policies?limit=100&offset=0');
  assert.equal(items.length, 2);
  assert.equal(items[0].policy_id, 'P1');
  assert.equal(items[1].amount_krw, 50000);
  assert.equal(items[1].estimated_total_krw, null);
});

test('pages through offset until every item is collected', async () => {
  const requests = [];
  const api = createPoliciesApi({ pageSize: 2, fetchImpl: async url => {
    requests.push(url);
    if (url.includes('offset=0')) return page([item('P1'), item('P2')], 5, 0);
    if (url.includes('offset=2')) return page([item('P3'), item('P4')], 5, 2);
    return page([item('P5')], 5, 4);
  } });
  const items = await api.list();
  assert.deepEqual(items.map(i => i.policy_id), ['P1', 'P2', 'P3', 'P4', 'P5']);
  assert.equal(requests.length, 3);
});

test('a malformed item is skipped, not fatal to the whole catalog', async () => {
  const api = createPoliciesApi({ fetchImpl: async () => page([item('P1'), { title: 'no policy_id' }, null, item('P2')], 2, 0) });
  const items = await api.list();
  assert.deepEqual(items.map(i => i.policy_id), ['P1', 'P2']);
});

test('a null/negative amount or non-string title never becomes a fabricated value', async () => {
  const api = createPoliciesApi({ fetchImpl: async () => page([item('P1', { title: 42, amount_krw: -5, estimated_total_krw: 'a lot', apply_end: 2026 })], 1, 0) });
  const [result] = await api.list();
  assert.equal(result.title, null);
  assert.equal(result.amount_krw, null);
  assert.equal(result.estimated_total_krw, null);
  assert.equal(result.apply_end, null);
});

test('normalizes HTTP and malformed catalog responses', async () => {
  await assert.rejects(
    () => createPoliciesApi({ fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }) }).list(),
    error => error.status === 500,
  );
  await assert.rejects(
    () => createPoliciesApi({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ total: 1 }) }) }).list(),
    error => error.code === 'INVALID_RESPONSE',
  );
});

test('an empty page stops pagination even if total claims more are left', async () => {
  const api = createPoliciesApi({ fetchImpl: async () => page([], 5, 0) });
  assert.deepEqual(await api.list(), []);
});
