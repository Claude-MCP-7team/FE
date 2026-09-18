import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, createProfileApi, fromBackendProfile, toBackendProfile } from '../src/profile-api.js';
import { serverChoices } from '../src/profile.js';
const profile = { birth_date: '2002-05-12', region: '41465', residence_start_date: '2026-05-01', education: 'graduated', employment_status: 'unemployed', marital_status: 'single', household_size: 3, personal_income: null, household_income: null, employment_type: null };
function fakeFetch(queue) { const calls = []; return { calls, fetch: async (url, options) => { calls.push({ url, options }); const next = queue.shift(); if (next instanceof Error) throw next; const body = next.body ?? ''; return new Response(body || null, { status: next.status ?? 200, headers: body ? { 'Content-Type': 'application/json' } : undefined }); } }; }
function storage() { const m = new Map(); return { getItem: key => m.get(key) ?? null, setItem: (key, value) => m.set(key, value), removeItem: key => m.delete(key) }; }
test('maps supported draft values to BE core/history/consent contract', () => { const result = toBackendProfile(profile, { receivedPolicyIds: ['P1'], similarProgramParticipation2y: false, incomeBasis: 'household_incl_parents', householdIncomeRatioMedian: 120 }); assert.deepEqual(result.core, { birth_date: '2002-05-12', region_code: '41465', residence_start_date: '2026-05-01', education: 'university_graduated', employment_status: 'job_seeking', employment_start_date: null, marital_status: 'single', household_size: 3, income_basis: 'household_incl_parents', household_income_ratio_median: 120 }); assert.deepEqual(result.history, { received_policy_ids: ['P1'], similar_program_participation_2y: false }); assert.deepEqual(result.consent, { privacy_agreed_at: null }); });
test('does not silently discard unsupported income or employment fields', () => { assert.throws(() => toBackendProfile({ ...profile, household_income: 3000000 }), e => e instanceof ApiError && e.code === 'PROFILE_MAPPING_REQUIRED'); });

test('district selections serialize and reload exactly without city or nationwide substitutions', () => {
  const expected = [['41461', '경기도 용인시 처인구'], ['41463', '경기도 용인시 기흥구'], ['41465', '경기도 용인시 수지구']];
  assert.deepEqual(serverChoices.region, expected);
  for (const [region] of expected) {
    const backend = toBackendProfile({ ...profile, region });
    assert.equal(backend.core.region_code, region);
    assert.equal(fromBackendProfile(backend).region, region);
  }
  for (const region of ['gyeonggi-yongin', 'gyeonggi-other', 'other', '41', '00', '11110', '__proto__', 'constructor']) {
    assert.throws(() => toBackendProfile({ ...profile, region }), e => e.code === 'PROFILE_MAPPING_REQUIRED', region);
  }
});
test('rejects unsupported enum and region values instead of converting them to null', () => { for (const draft of [{ ...profile, education: 'on-leave' }, { ...profile, employment_status: 'other' }, { ...profile, marital_status: 'other' }, { ...profile, region: 'unknown' }]) assert.throws(() => toBackendProfile(draft), e => e instanceof ApiError && e.code === 'PROFILE_MAPPING_REQUIRED'); });
test('maps a BE profile back to the existing form draft shape', () => { assert.deepEqual(fromBackendProfile({ core: { birth_date: '2002-05-12', region_code: '41465', education: 'university_enrolled', employment_status: 'founder', marital_status: 'married', household_size: 2 }, history: { received_policy_ids: ['P1'] } }), { birth_date: '2002-05-12', region: '41465', residence_start_date: '', education: 'enrolled', employment_status: 'self-employed', marital_status: 'married', household_size: 2, personal_income: null, household_income: null, employment_type: null, policy_history: 'yes' }); });
test('creates session with JSON and sends session header on subsequent requests', async () => { const f = fakeFetch([{ status: 201, body: JSON.stringify({ session_id: '123e4567-e89b-42d3-a456-426614174000' }) }, { status: 204 }]); const api = createProfileApi({ baseUrl: 'https://be.test/', fetchImpl: f.fetch, storage: storage() }); const id = await api.create({ core: {} }); await api.put({ core: {} }); assert.equal(id, api.sessionId); assert.equal(f.calls[0].url, 'https://be.test/v1/sessions'); assert.equal(f.calls[1].options.headers.get('X-Session-Id'), id); assert.equal(f.calls[1].options.headers.get('Content-Type'), 'application/json'); });
test('gets profile, creates on upsert without session, and removes session after delete', async () => { const store = storage(); const f = fakeFetch([{ status: 201, body: JSON.stringify({ session_id: '123e4567-e89b-42d3-a456-426614174000' }) }, { status: 200, body: JSON.stringify({ session_id: '123e4567-e89b-42d3-a456-426614174000', profile: { core: { birth_date: '2002-05-12' } } }) }, { status: 204 }]); const api = createProfileApi({ fetchImpl: f.fetch, storage: store }); await api.upsert({ core: {} }); assert.deepEqual(await api.get(), { core: { birth_date: '2002-05-12' } }); assert.equal(await api.remove(), true); assert.equal(api.sessionId, null); });
test('clears expired session after 404 and does not hide other errors', async () => { const store = storage(); const f = fakeFetch([{ status: 404, body: JSON.stringify({ detail: '없음' }) }]); const api = createProfileApi({ fetchImpl: f.fetch, storage: store }); store.setItem('ypc.session-id.v1', '123e4567-e89b-42d3-a456-426614174000'); await assert.rejects(api.get(), e => e.status === 404); assert.equal(api.sessionId, null); });
test('normalizes network, invalid JSON response and HTTP errors', async () => { const networkStore = storage(); networkStore.setItem('ypc.session-id.v1', '123e4567-e89b-42d3-a456-426614174000'); const network = createProfileApi({ fetchImpl: async () => { throw new Error('offline'); }, storage: networkStore }); await assert.rejects(network.get(), e => e.code === 'NETWORK_ERROR'); const invalid = createProfileApi({ fetchImpl: async () => new Response('{broken', { status: 200 }), storage: storage() }); await assert.rejects(invalid.create(), e => e.code === 'INVALID_RESPONSE'); const http = createProfileApi({ fetchImpl: async () => new Response(JSON.stringify({ detail: 'bad' }), { status: 422 }), storage: storage() }); await assert.rejects(http.create(), e => e.status === 422 && e.detail === 'bad'); });
test('upsert uses PUT for an existing session and create uses no body when empty', async () => { const store = storage(); store.setItem('ypc.session-id.v1', '123e4567-e89b-42d3-a456-426614174000'); const f = fakeFetch([{ status: 204 }]); const api = createProfileApi({ fetchImpl: f.fetch, storage: store }); await api.upsert({ core: {} }); assert.equal(f.calls[0].url, '/v1/sessions/123e4567-e89b-42d3-a456-426614174000'); });

test('failed deletion preserves the session so the same deletion can be retried', async () => {
  for (const failure of [new Error('offline'), { status: 403 }, { status: 500 }]) {
    const store = storage();
    const id = '123e4567-e89b-42d3-a456-426614174000';
    store.setItem('ypc.session-id.v1', id);
    const f = fakeFetch([failure, { status: 204 }]);
    const api = createProfileApi({ fetchImpl: f.fetch, storage: store });
    await assert.rejects(api.remove(), ApiError);
    assert.equal(api.sessionId, id);
    assert.equal(await api.remove(), true);
    assert.equal(f.calls[1].options.headers.get('X-Session-Id'), id);
    assert.equal(api.sessionId, null);
    assert.equal(await api.remove(), false);
    assert.equal(f.calls.length, 2);
  }
});

test('deleting an already absent session clears its local identifier', async () => {
  const store = storage();
  store.setItem('ypc.session-id.v1', '123e4567-e89b-42d3-a456-426614174000');
  const f = fakeFetch([{ status: 404 }]);
  const api = createProfileApi({ fetchImpl: f.fetch, storage: store });
  assert.equal(await api.remove(), true);
  assert.equal(api.sessionId, null);
});

test('invalid profile responses fail without clearing the session', async () => {
  for (const body of ['', '{broken', '{}', 'null', '{"profile":[]}', '{"profile":false}', '{"profile":"invalid"}']) {
    const store = storage();
    const id = '123e4567-e89b-42d3-a456-426614174000';
    store.setItem('ypc.session-id.v1', id);
    const f = fakeFetch([{ body }]);
    const api = createProfileApi({ fetchImpl: f.fetch, storage: store });
    await assert.rejects(api.get(), e => e instanceof ApiError && e.code === 'INVALID_RESPONSE');
    assert.equal(api.sessionId, id);
  }
});

test('an explicitly null profile is a valid empty session', async () => {
  const store = storage();
  store.setItem('ypc.session-id.v1', '123e4567-e89b-42d3-a456-426614174000');
  const f = fakeFetch([{ body: '{"profile":null}' }]);
  const api = createProfileApi({ fetchImpl: f.fetch, storage: store });
  assert.equal(await api.get(), null);
  assert.notEqual(api.sessionId, null);
});

test('interrupted response bodies become retryable network errors', async () => {
  const store = storage();
  const id = '123e4567-e89b-42d3-a456-426614174000';
  store.setItem('ypc.session-id.v1', id);
  const api = createProfileApi({ storage: store, fetchImpl: async () => ({
    ok: true, status: 200, text: async () => { throw new Error('stream interrupted'); },
  }) });
  await assert.rejects(api.get(), e => e instanceof ApiError && e.code === 'NETWORK_ERROR');
  assert.equal(api.sessionId, id);
});

test('expired PUT clears the session and an explicit retry creates a new session', async () => {
  const store = storage();
  store.setItem('ypc.session-id.v1', '123e4567-e89b-42d3-a456-426614174000');
  const f = fakeFetch([{ status: 404 }, { status: 201, body: '{"session_id":"123e4567-e89b-42d3-a456-426614174001"}' }]);
  const api = createProfileApi({ storage: store, fetchImpl: f.fetch });
  await assert.rejects(api.upsert({ core: {} }), e => e.status === 404);
  assert.equal(api.sessionId, null);
  assert.equal(f.calls.length, 1);
  await api.upsert({ core: {} });
  assert.equal(f.calls[1].options.method, 'POST');
  assert.equal(f.calls[1].options.headers.has('X-Session-Id'), false);
});
