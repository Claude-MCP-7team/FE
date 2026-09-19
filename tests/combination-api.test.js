import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCombinationApi } from '../src/combination-api.js';

const response = await readFile(new URL('./fixtures/combinations.json', import.meta.url), 'utf8');
const fakeFetch = (body, status = 200) => async (url, options) => ({ ok: status >= 200 && status < 300, status, json: async () => JSON.parse(body), url, options });

test('posts the complete profile and session header to combinations', async () => {
  let request;
  const api = createCombinationApi({ baseUrl: 'https://be.test/', fetchImpl: async (url, options) => { request = { url, options }; return { ok: true, status: 200, json: async () => JSON.parse(response) }; } });
  const profile = { core: { birth_date: '2000-01-01' }, answers: { income: 100 } };
  const result = await api.list(profile, { sessionId: 'session-1' });
  assert.equal(request.url, 'https://be.test/v1/combinations');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.get('X-Session-Id'), 'session-1');
  assert.deepEqual(JSON.parse(request.options.body), profile);
  assert.equal(result.scenarios.length, 2);
});

test('normalizes HTTP and malformed combination responses', async () => {
  await assert.rejects(() => createCombinationApi({ fetchImpl: fakeFetch(JSON.stringify({ detail: 'bad' }), 422) }).list({ core: {} }), error => error.code === 'HTTP_ERROR' && error.status === 422);
  await assert.rejects(() => createCombinationApi({ fetchImpl: fakeFetch('{}') }).list({ core: {} }), error => error.code === 'INVALID_RESPONSE');
});
