import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { once } from 'node:events';
import { createJudgementApi } from '../src/judgement-api.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/judgement.json', import.meta.url), 'utf8'));
const profile = { core: { birth_date: '2000-01-01', region_code: '41465', household_income_ratio_median: null }, history: { received_policy_ids: ['TEST-PAST'], similar_program_participation_2y: false }, answers: { income: 0, housing: false }, consent: { privacy_agreed_at: null } };

test('posts the complete server profile once with include=all and an optional session header', async () => {
  for (const sessionId of [null, '123e4567-e89b-42d3-a456-426614174000']) {
    let calls = 0;
    const before = structuredClone(profile);
    const api = createJudgementApi({ baseUrl: 'https://be.test/', fetchImpl: async (url, options) => {
      calls++;
      assert.equal(url, 'https://be.test/v1/judge?include=all');
      assert.equal(options.method, 'POST');
      assert.equal(options.cache, 'no-store');
      assert.equal(options.headers.get('Content-Type'), 'application/json');
      assert.equal(options.headers.get('X-Session-Id'), sessionId);
      assert.deepEqual(JSON.parse(options.body), before);
      return Response.json({ ...fixture, session_id: sessionId ?? 'anonymous' });
    } });
    assert.equal((await api.judge(profile, { sessionId })).results.length, 3);
    assert.equal(calls, 1);
    assert.deepEqual(profile, before);
  }
});

test('distinguishes transport, malformed response, HTTP, and mismatched-session failures', async () => {
  const cases = [
    [async () => { throw new Error('offline'); }, 'NETWORK_ERROR', 0],
    [async () => ({ ok: true, text: async () => { throw new Error('stream interrupted'); } }), 'NETWORK_ERROR', 0],
    [async () => new Response('{broken'), 'INVALID_RESPONSE', 0],
    [async () => Response.json({ ...fixture, session_id: 'another-session' }), 'INVALID_RESPONSE', 0],
    [async () => Response.json({ detail: 'snapshot unavailable' }, { status: 503 }), 'HTTP_ERROR', 503],
    [async () => Response.json({ detail: [{ loc: ['core'], msg: 'invalid' }] }, { status: 422 }), 'HTTP_ERROR', 422],
    [async () => new Response('<html>bad gateway</html>', { status: 502 }), 'HTTP_ERROR', 502],
    [async () => new Response(null, { status: 304 }), 'HTTP_ERROR', 304],
    [async () => Response.json({ ...fixture, summary: { eligible: 100, ineligible: 1, needs_info: 1 } }), 'INVALID_RESPONSE', 0],
  ];
  for (const [fetchImpl, code, status] of cases) {
    const api = createJudgementApi({ fetchImpl });
    await assert.rejects(api.judge(profile), error => error.code === code && error.status === status && !error.message.includes('[object Object]'));
  }
});

test('cancellation aborts an in-flight request and pre-cancelled requests never send a profile', async () => {
  const controller = new AbortController(); let receivedSignal; let calls = 0;
  const api = createJudgementApi({ fetchImpl: async (url, options) => { calls++; receivedSignal = options.signal; return new Promise(() => {}); } });
  const pending = api.judge(profile, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.code === 'REQUEST_CANCELLED');
  assert.equal(receivedSignal.aborted, true);
  await assert.rejects(api.judge(profile, { signal: controller.signal }), error => error.code === 'REQUEST_CANCELLED');
  assert.equal(calls, 1);
});

test('timeout covers body reads as well as connection waits and allows an explicit retry', async () => {
  for (const stallsInBody of [false, true]) {
    let calls = 0; let receivedSignal;
    const api = createJudgementApi({ timeoutMs: 10, fetchImpl: async (url, options) => {
      calls++; receivedSignal = options.signal;
      if (calls > 1) return Response.json(fixture);
      if (stallsInBody) return { ok: true, text: () => new Promise(() => {}) };
      return new Promise(() => {});
    } });
    await assert.rejects(api.judge(profile), error => error.code === 'REQUEST_TIMEOUT');
    assert.equal(receivedSignal.aborted, true);
    assert.equal(calls, 1);
    assert.equal((await api.judge(profile)).snapshot_version, fixture.snapshot_version);
  }
});

test('rejects a flat draft before making a request', async () => {
  let calls = 0;
  const api = createJudgementApi({ fetchImpl: async () => { calls++; return Response.json(fixture); } });
  for (const value of [null, { birth_date: '2000-01-01', region: '41465' }, { core: [] }]) {
    await assert.rejects(api.judge(value), error => error.code === 'INVALID_PROFILE');
  }
  assert.equal(calls, 0);
});

test('uses real HTTP to send the server profile and validate the complete response', async t => {
  const requests = [];
  const sessionId = '123e4567-e89b-42d3-a456-426614174000';
  const server = http.createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk;
    requests.push({ method: request.method, url: request.url, body: JSON.parse(body), sessionId: request.headers['x-session-id'] });
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ ...fixture, session_id: sessionId }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const api = createJudgementApi({ baseUrl: `http://127.0.0.1:${server.address().port}` });
  const result = await api.judge(profile, { sessionId });
  assert.equal(result.results[1].unmatched[0].satisfiable_from, '2027-01-01');
  assert.deepEqual(requests, [{ method: 'POST', url: '/v1/judge?include=all', body: profile, sessionId }]);
});
