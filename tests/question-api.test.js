import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createQuestionApi } from '../src/question-api.js';

const queue = JSON.parse(await readFile(new URL('./fixtures/questions.json', import.meta.url), 'utf8'));
const profile = { core: { birth_date: '2000-01-01', region_code: '41465' }, history: {}, answers: {}, consent: {} };

test('posts the complete profile to the merged question endpoint', async () => {
  let request;
  const result = await createQuestionApi({ baseUrl: 'https://be.test', fetchImpl: async (url, options) => { request = { url, options }; return Response.json(queue); } }).list(profile, { sessionId: 'session-1' });
  assert.equal(request.url, 'https://be.test/v1/questions');
  assert.equal(request.options.headers.get('X-Session-Id'), 'session-1');
  assert.deepEqual(JSON.parse(request.options.body), profile);
  assert.equal(result.questions[0].field, 'household_income_ratio_median');
});

test('normalizes question network, HTTP, malformed and timeout errors', async () => {
  for (const [fetchImpl, code, status] of [[async () => { throw new Error('offline'); }, 'NETWORK_ERROR', 0], [async () => Response.json({ detail: 'bad' }, { status: 503 }), 'HTTP_ERROR', 503], [async () => new Response('{broken'), 'INVALID_RESPONSE', 0], [async () => new Promise(() => {}), 'REQUEST_TIMEOUT', 0]]) {
    await assert.rejects(createQuestionApi({ timeoutMs: 5, fetchImpl }).list(profile), error => error.code === code && error.status === status);
  }
});
