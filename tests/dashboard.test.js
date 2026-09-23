import test from 'node:test';
import assert from 'node:assert/strict';

const { mountLiveDashboard } = await import('../src/dashboard.js');
const { toJudgementView } = await import('../src/judgement-contract.js');
const { readFile } = await import('node:fs/promises');
const fixture = JSON.parse(await readFile(new URL('./fixtures/judgement.json', import.meta.url), 'utf8'));

function deferred() {
  let resolve; let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fakeButton() {
  return { listeners: {}, addEventListener(type, listener) { this.listeners[type] = listener; }, click() { this.listeners.click?.(); } };
}

class FakeRoot {
  constructor() { this.writes = 0; }
  set innerHTML(value) {
    this.html = value; this.writes++;
    this.rerun = value.includes('id="rerun"') ? fakeButton() : null;
    this.comboRetry = value.includes('data-combo-retry') ? fakeButton() : null;
    this.planRetry = value.includes('data-plan-retry') ? fakeButton() : null;
  }
  querySelector(selector) {
    if (selector === '#rerun') return this.rerun;
    if (selector === '[data-combo-retry]') return this.comboRetry;
    if (selector === '[data-plan-retry]') return this.planRetry;
    return null;
  }
  querySelectorAll() { return []; }
}

const previousDocument = globalThis.document;
function withFakeDocument(fn) {
  globalThis.document = { body: { style: {} }, addEventListener() {}, removeEventListener() {}, activeElement: null };
  return fn().finally(() => { globalThis.document = previousDocument; });
}

test('combination and plan load independently and the panels reflect what each API returned', () => withFakeDocument(async () => {
  const root = new FakeRoot();
  const judgement = toJudgementView(structuredClone(fixture));
  const profileApi = { sessionId: 's-1', get: async () => ({ core: {} }) };
  const combo = deferred(); const plan = deferred();
  let comboSignal; let planSignal;
  const combinationApi = { list: async (_profile, options) => { comboSignal = options.signal; return combo.promise; } };
  const planApi = { list: async (_profile, options) => { planSignal = options.signal; return plan.promise; } };
  mountLiveDashboard(root, { judgement, profileApi, combinationApi, planApi });
  assert.match(root.html, /조합을 계산하는 중이에요/);
  assert.match(root.html, /서류를 불러오는 중이에요/);

  combo.resolve({ snapshot_version: 'v1', eligible_count: 1, disclaimer: 'd', scenarios: [{ kind: 'conservative', label: '보수', description: '', combinations: [{ rank: 1, total_krw: 500000, total_is_estimated: false, members: [{ policy_id: 'P1', title: '면접수당', estimated_total_krw: 500000, amount_estimated: false }], excluded: [] }] }] });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(root.html, /500,000원/);
  assert.match(root.html, /면접수당/);
  assert.match(root.html, /서류를 불러오는 중이에요/, 'plan panel is still loading independently of the now-ready combo panel');

  plan.resolve({ snapshot_version: 'v1', generated_for_date: '2026-09-20', summary: {}, plans: [{ policy_id: 'P1', title: '면접수당 신청', status: 'URGENT', deadline_date: '2026-09-30', recommended_start_date: '2026-09-20', reason: '', documents: [] }], documents: [{ name: '주민등록등본', issuer: '정부24', lead_time_business_days: 0, requires_visit: false, master_unverified: false, required_by: ['P1'], required_by_titles: ['면접수당 신청'] }], total_document_cost_krw: 0 });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(root.html, /면접수당 신청/);
  assert.match(root.html, /주민등록등본/);
  assert.equal(comboSignal.aborted, false);
  assert.equal(planSignal.aborted, false);
}));

test('a missing profile surfaces as a normal error panel per side, not a thrown exception', () => withFakeDocument(async () => {
  const root = new FakeRoot();
  const judgement = toJudgementView(structuredClone(fixture));
  const profileApi = { sessionId: null, get: async () => null };
  const combinationApi = { list: async () => { throw new Error('should not be called without a profile'); } };
  const planApi = { list: async () => { throw new Error('should not be called without a profile'); } };
  mountLiveDashboard(root, { judgement, profileApi, combinationApi, planApi });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(root.html, /저장된 조건이 없어요/);
  assert.match(root.html, /data-combo-retry/);
  assert.match(root.html, /data-plan-retry/);
}));

test('retrying the combination panel re-fetches only that panel', () => withFakeDocument(async () => {
  const root = new FakeRoot();
  const judgement = toJudgementView(structuredClone(fixture));
  let calls = 0;
  const profileApi = { sessionId: 's-1', get: async () => ({ core: {} }) };
  const combinationApi = { list: async () => { calls++; if (calls === 1) throw new Error('offline'); return { snapshot_version: 'v1', eligible_count: 0, disclaimer: 'd', scenarios: [] }; } };
  const planApi = { list: async () => ({ snapshot_version: 'v1', generated_for_date: '2026-09-20', summary: {}, plans: [], documents: [], total_document_cost_krw: 0 }) };
  mountLiveDashboard(root, { judgement, profileApi, combinationApi, planApi });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(root.html, /offline/);
  root.querySelector('[data-combo-retry]').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2);
  assert.match(root.html, /추천할 수 있는 조합이 아직 없어요/);
}));

test('the reanalyze button calls back into the app instead of only toasting a demo message', () => withFakeDocument(async () => {
  const root = new FakeRoot();
  const judgement = toJudgementView(structuredClone(fixture));
  const profileApi = { sessionId: 's-1', get: async () => ({ core: {} }) };
  const combinationApi = { list: async () => new Promise(() => {}) };
  const planApi = { list: async () => new Promise(() => {}) };
  let reanalyzed = 0;
  mountLiveDashboard(root, { judgement, profileApi, combinationApi, planApi, onReanalyze: () => { reanalyzed++; } });
  root.querySelector('#rerun').click();
  assert.equal(reanalyzed, 1);
}));

test('destroy aborts in-flight combination and plan requests', () => withFakeDocument(async () => {
  const root = new FakeRoot();
  const judgement = toJudgementView(structuredClone(fixture));
  const profileApi = { sessionId: 's-1', get: async () => ({ core: {} }) };
  let comboSignal; let planSignal;
  const combinationApi = { list: async (_profile, options) => { comboSignal = options.signal; return new Promise(() => {}); } };
  const planApi = { list: async (_profile, options) => { planSignal = options.signal; return new Promise(() => {}); } };
  const mount = mountLiveDashboard(root, { judgement, profileApi, combinationApi, planApi });
  await new Promise(resolve => setImmediate(resolve));
  mount.destroy();
  assert.equal(comboSignal.aborted, true);
  assert.equal(planSignal.aborted, true);
}));
