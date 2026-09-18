import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createProfileRepository } from '../src/profile-repository.js';
import { createProfileApi, fromBackendProfile, toBackendProfile } from '../src/profile-api.js';

const draft = { birth_date: '2000-01-01', region: 'gyeonggi-yongin', residence_start_date: '2020-01-01', education: 'graduated', employment_status: 'employed', marital_status: 'single', household_size: 2, personal_income: null, household_income: null, employment_type: null, policy_history: null };
const stored = () => ({ ...toBackendProfile(draft), core: { ...toBackendProfile(draft).core, employment_start_date: '2023-01-01', income_basis: 'household_incl_parents', household_income_ratio_median: 120, residence_continuous: false }, history: { received_policy_ids: ['P1'], similar_program_participation_2y: false }, answers: { housing: true }, consent: { terms_version: '1.0', privacy_agreed_at: '2026-09-01T00:00:00Z', retention_days: 90 } });

test('form loads during save or delete wait and share a fresh read of the resulting state', async () => {
  for (const kind of ['save', 'remove']) {
    let backend = stored(); let finish; let reads = 0;
    const repository = createProfileRepository({
      get: async () => { reads++; return backend; },
      upsert: value => new Promise(resolve => { finish = () => { backend = value; resolve(); }; }),
      remove: () => new Promise(resolve => { finish = () => { backend = null; resolve(); }; }),
    });
    const before = await repository.loadForForm();
    const mutation = kind === 'save' ? repository.save({ ...before, household_size: 5 }) : repository.remove();
    const reentry1 = repository.loadForForm(); const reentry2 = repository.loadForForm();
    assert.equal(reads, 1);
    finish(); await mutation;
    const [one, two] = await Promise.all([reentry1, reentry2]);
    assert.equal(reads, 2); assert.deepEqual(one, two);
    if (kind === 'save') assert.equal(one.household_size, 5); else assert.equal(one, null);
  }
});

test('form reentry after a failed mutation reads the server and does not swallow read failures', async () => {
  let rejectSave; let failRead = false;
  const repository = createProfileRepository({ get: async () => { if (failRead) throw new Error('read failed'); return stored(); }, upsert: () => new Promise((resolve, reject) => { rejectSave = reject; }) });
  const before = await repository.loadForForm();
  const saving = repository.save(before);
  const saveFailure = assert.rejects(saving, /write failed/);
  const reentry = repository.loadForForm();
  const readFailure = assert.rejects(reentry, /read failed/);
  failRead = true; rejectSave(new Error('write failed'));
  await Promise.all([saveFailure, readFailure]);
  failRead = false; assert.deepEqual(await repository.loadForForm(), before);
});

test('editing one field preserves every hidden server field and leaves the source untouched', async () => {
  const original = stored(); const snapshot = structuredClone(original); let sent;
  const repository = createProfileRepository({ get: async () => original, upsert: async value => { sent = value; } });
  const loaded = await repository.load();
  await repository.save({ ...loaded, household_size: 3 });
  const expected = structuredClone(original); expected.core.household_size = 3;
  assert.deepEqual(sent, expected); assert.deepEqual(original, snapshot);
});

test('unknown server select values survive unrelated edits and can be explicitly changed', async () => {
  const original = stored(); original.core.education = 'high_school'; original.core.region_code = '11110'; let sent;
  const repository = createProfileRepository({ get: async () => original, upsert: async value => { sent = value; } });
  const loaded = await repository.load();
  assert.equal(loaded.education, 'high_school');
  assert.deepEqual(repository.validate(loaded).errors, {});
  await repository.save({ ...loaded, household_size: 4 });
  assert.equal(sent.core.education, 'high_school'); assert.equal(sent.core.region_code, '11110');
  await repository.save({ ...loaded, education: 'enrolled' });
  assert.equal(sent.core.education, 'university_enrolled');
});

test('failed initial load blocks saving until a successful retry', async () => {
  let fail = true; let writes = 0;
  const repository = createProfileRepository({ get: async () => { if (fail) throw new Error('offline'); return null; }, upsert: async () => { writes++; } });
  await assert.rejects(repository.load());
  await assert.rejects(repository.save(draft), e => e.code === 'PROFILE_NOT_LOADED');
  assert.equal(writes, 0); fail = false; await repository.load(); await repository.save(draft); assert.equal(writes, 1);
});

test('unsupported inputs fail before writing and failed writes preserve the saved baseline', async () => {
  let attempts = 0; let fail = true; let sent;
  const repository = createProfileRepository({ get: async () => stored(), upsert: async value => { attempts++; if (fail) throw new Error('offline'); sent = value; } });
  const loaded = await repository.load();
  for (const change of [{ personal_income: 0 }, { employment_type: 'regular' }, { education: 'on-leave' }, { policy_history: 'none' }]) {
    const key = Object.keys(change)[0];
    assert.ok(repository.validate({ ...loaded, ...change }).errors[key]);
    await assert.rejects(repository.save({ ...loaded, ...change }), e => e.code === 'INVALID_PROFILE' && !!e.detail[key]);
  }
  assert.equal(attempts, 0);
  await assert.rejects(repository.save({ ...loaded, household_size: 3 }));
  fail = false; await repository.save({ ...loaded, marital_status: 'married' });
  assert.equal(sent.core.household_size, 2); assert.deepEqual(sent.answers, stored().answers);
});

test('server profiles accept confirmed enums and unknown residence dates without losing hidden fields', async () => {
  let backend = stored(); backend.core.residence_start_date = null;
  const repository = createProfileRepository({ get: async () => backend, upsert: async value => { backend = value; } });
  const loaded = await repository.load();
  assert.deepEqual(repository.validate(loaded).errors, {});
  const cases = [
    ['middle_or_below', 'student', 'divorced'],
    ['high_school_enrolled', 'neet', 'widowed'],
    ['high_school_graduated', 'employed', 'single'],
    ['graduate_school', 'self-employed', 'married'],
  ];
  for (const [education, employment_status, marital_status] of cases) {
    await repository.save({ ...loaded, education, employment_status, marital_status });
    assert.equal(backend.core.education, education);
    assert.equal(backend.core.employment_status, employment_status === 'self-employed' ? 'founder' : employment_status);
    assert.equal(backend.core.marital_status, marital_status);
    assert.equal(backend.core.residence_start_date, null);
    assert.deepEqual(backend.answers, stored().answers);
    assert.deepEqual(backend.history, stored().history);
    assert.deepEqual(backend.consent, stored().consent);
  }
});

test('server validation requires birth and region, checks supplied residence dates, and reports every unsupported input', async () => {
  let sent;
  const repository = createProfileRepository({ get: async () => null, upsert: async value => { sent = value; } });
  await repository.load();
  const minimal = { ...draft, residence_start_date: '', education: null, employment_status: null, marital_status: null };
  await repository.save(minimal);
  assert.equal(sent.core.residence_start_date, null);
  for (const date of ['1900-02-29', '1999-12-31', '9999-01-01']) {
    assert.ok(repository.validate({ ...minimal, residence_start_date: date }).errors.residence_start_date);
  }
  assert.ok(repository.validate({ ...minimal, birth_date: '' }).errors.birth_date);
  assert.ok(repository.validate({ ...minimal, region: '' }).errors.region);
  const invalid = { ...minimal, personal_income: 0, household_income: 100, employment_type: 'regular', policy_history: 'yes' };
  assert.deepEqual(Object.keys(repository.validate(invalid).errors).sort(), ['employment_type', 'household_income', 'personal_income', 'policy_history']);
  await assert.rejects(repository.save(invalid), e => e.code === 'INVALID_PROFILE');
  assert.equal(sent.core.residence_start_date, null);
});

test('duplicate in-flight requests are rejected and failed deletion can be retried', async () => {
  let resolveSave; let failures = 1;
  const repository = createProfileRepository({ get: async () => stored(), upsert: () => new Promise(resolve => { resolveSave = resolve; }), remove: async () => { if (failures--) throw new Error('offline'); } });
  const loaded = await repository.load(); const pending = repository.save(loaded);
  await assert.rejects(repository.save(loaded), e => e.code === 'REQUEST_PENDING');
  await assert.rejects(repository.load(), e => e.code === 'REQUEST_PENDING');
  await assert.rejects(repository.remove(), e => e.code === 'REQUEST_PENDING');
  resolveSave(); await pending;
  await assert.rejects(repository.remove()); await repository.remove();
});

test('expired and invalid initial sessions are distinguished', async () => {
  const expired = createProfileRepository({ get: async () => { throw Object.assign(new Error('expired'), { status: 404 }); } });
  assert.equal(await expired.load(), null);
  for (const profile of [{}, { core: [] }, { core: null }]) {
    const invalid = createProfileRepository({ get: async () => profile });
    await assert.rejects(invalid.load(), e => e.code === 'INVALID_RESPONSE');
    await assert.rejects(invalid.save(draft), e => e.code === 'PROFILE_NOT_LOADED');
  }
});

test('full API workflow creates, reloads, updates, and deletes the same session', async () => {
  const values = new Map(); const calls = []; let backend = null;
  const id = '123e4567-e89b-42d3-a456-426614174000';
  const api = createProfileApi({ storage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) }, fetchImpl: async (url, options) => {
    const method = options.method ?? 'GET'; calls.push(method);
    if (method === 'POST') { backend = JSON.parse(options.body); return Response.json({ session_id: id }, { status: 201 }); }
    assert.equal(options.headers.get('X-Session-Id'), id);
    if (method === 'GET') return Response.json({ profile: backend });
    if (method === 'PUT') backend = JSON.parse(options.body);
    if (method === 'DELETE') backend = null;
    return new Response(null, { status: 204 });
  } });
  const first = createProfileRepository(api); await first.load(); await first.save(draft);
  const reloaded = createProfileRepository(api); const value = await reloaded.load();
  assert.deepEqual(value, fromBackendProfile(backend));
  await reloaded.save({ ...value, household_size: 3 }); assert.equal(backend.core.household_size, 3);
  await reloaded.remove(); assert.equal(backend, null); assert.equal(api.sessionId, null);
  assert.deepEqual(calls, ['POST', 'GET', 'PUT', 'DELETE']);
});

test('repository uses real HTTP against a disposable local session server', async t => {
  let backend = null;
  const id = '123e4567-e89b-42d3-a456-426614174000';
  const calls = [];
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    calls.push({ method: req.method, path: req.url, session: req.headers['x-session-id'] });
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'POST') { backend = JSON.parse(body); res.writeHead(201).end(JSON.stringify({ session_id: id })); }
    else if (req.method === 'GET') res.end(JSON.stringify({ profile: backend }));
    else { backend = req.method === 'DELETE' ? null : JSON.parse(body); res.writeHead(204).end(); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const map = new Map();
  const api = createProfileApi({ baseUrl: `http://127.0.0.1:${server.address().port}`, storage: { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) } });
  const repository = createProfileRepository(api);
  await repository.load(); await repository.save(draft);
  const loaded = await repository.load(); await repository.save({ ...loaded, household_size: 4 });
  assert.equal(backend.core.household_size, 4);
  await repository.remove(); assert.equal(backend, null);
  assert.deepEqual(calls.map(c => c.method), ['POST', 'GET', 'PUT', 'DELETE']);
  for (const call of calls.slice(1)) { assert.equal(call.path, `/v1/sessions/${id}`); assert.equal(call.session, id); }
});
