import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPlanApi } from '../src/plan-api.js';

const response = await readFile(new URL('./fixtures/plan.json', import.meta.url), 'utf8');

test('posts profile, session and selected policy headers to the plan endpoint', async () => {
  let request;
  const api = createPlanApi({ baseUrl: 'https://be.test/', fetchImpl: async (url, options) => { request = { url, options }; return { ok: true, status: 200, json: async () => JSON.parse(response) }; } });
  const profile = { core: { birth_date: '2000-01-01' } };
  const result = await api.list(profile, { sessionId: 'session-1', policyIds: ['P-1', 'P-2'] });
  assert.equal(request.url, 'https://be.test/v1/plan');
  assert.equal(request.options.headers.get('X-Session-Id'), 'session-1');
  assert.equal(request.options.headers.get('X-Policy-Ids'), 'P-1,P-2');
  assert.deepEqual(JSON.parse(request.options.body), profile);
  assert.equal(result.summary.total, 1);
});

test('normalizes plan HTTP and malformed responses', async () => {
  const bad = async () => ({ ok: false, status: 503, json: async () => ({ detail: 'busy' }) });
  await assert.rejects(() => createPlanApi({ fetchImpl: bad }).list({ core: {} }), error => error.code === 'HTTP_ERROR' && error.status === 503);
  await assert.rejects(() => createPlanApi({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }) }).list({ core: {} }), error => error.code === 'INVALID_RESPONSE');
});
