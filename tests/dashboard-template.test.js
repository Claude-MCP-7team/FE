import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { toJudgementView } from '../src/judgement-contract.js';
import { liveDashboardSummary, liveFilteredResults, renderLiveDashboard } from '../src/dashboard-template.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/judgement.json', import.meta.url), 'utf8'));
const loading = { state: 'loading' };
const empty = { state: 'empty', items: [] };

test('summary counts split the ineligible tile the same way the plain dashboard does', () => {
  const view = toJudgementView(structuredClone(fixture));
  assert.deepEqual(liveDashboardSummary(view), { total: 3, pass: 1, future: 0, ask: 1 });
});

test('filtering selects only the requested status without mutating the view', () => {
  const view = toJudgementView(structuredClone(fixture));
  const snapshot = structuredClone(view);
  assert.deepEqual(liveFilteredResults(view, 'PASS').map(r => r.policy_id), ['TEST-ELIGIBLE']);
  assert.deepEqual(liveFilteredResults(view, 'UNKNOWN').map(r => r.policy_id), ['TEST-UNKNOWN']);
  assert.equal(liveFilteredResults(view, 'all').length, 3);
  assert.deepEqual(view, snapshot);
});

test('renders policy cards with the reference dashboard lowercase badge classes and a needs-info banner', () => {
  const view = toJudgementView(structuredClone(fixture));
  const html = renderLiveDashboard({ judgement: view, filter: 'all', combination: loading, documents: loading, plan: loading });
  assert.match(html, /data-status="pass"[^>]*data-policy-id="TEST-ELIGIBLE"/);
  assert.match(html, /data-status="fail"[^>]*data-policy-id="TEST-INELIGIBLE"/);
  assert.match(html, /data-status="ask"[^>]*data-policy-id="TEST-UNKNOWN"/);
  assert.match(html, /class="badge pass"/);
  assert.match(html, /class="badge fail"/);
  assert.match(html, /class="badge ask"/);
  assert.match(html, /id="questionBanner"/);
  assert.match(html, /1개 정책은 추가 정보가 필요해요/);
  assert.match(html, /href="#\/questions"/);
  assert.match(html, /<div class="value">3개<\/div>/);
});

test('the needs-info banner is absent once nothing is left to ask', () => {
  const clean = structuredClone(fixture);
  clean.results = clean.results.filter(result => result.verdict !== 'NEEDS_INFO');
  clean.summary.needs_info = 0;
  const view = toJudgementView(clean);
  const html = renderLiveDashboard({ judgement: view, filter: 'all', combination: loading, documents: loading, plan: loading });
  assert.doesNotMatch(html, /questionBanner/);
});

test('confidence never borrows a status colour and never leaks the raw enum', () => {
  const view = toJudgementView(structuredClone(fixture));
  const html = renderLiveDashboard({ judgement: view, filter: 'all', combination: loading, documents: loading, plan: loading });
  assert.match(html, /<span class="chip">추정 포함<\/span>/);
  assert.doesNotMatch(html, /ESTIMATED|NEEDS_REVIEW|CONFIRMED/);
});

test('a policy without a BE title is shown as an identifier, not a fabricated name', () => {
  const view = toJudgementView(structuredClone(fixture));
  const html = renderLiveDashboard({ judgement: view, filter: 'all', combination: loading, documents: loading, plan: loading });
  assert.match(html, /<code class="policy-ref">TEST-ELIGIBLE<\/code>/);
});

test('hostile explanation and policy id text is escaped, not injected', () => {
  const hostile = structuredClone(fixture);
  hostile.results[0].explanation = '<img src=x onerror=alert(1)>';
  hostile.results[0].policy_id = '<script>alert(1)</script>';
  hostile.results[1].policy_id = 'SAFE-2';
  hostile.results[2].policy_id = 'SAFE-3';
  const view = toJudgementView(hostile);
  const html = renderLiveDashboard({ judgement: view, filter: 'all', combination: loading, documents: loading, plan: loading });
  assert.doesNotMatch(html, /<script>alert|<img src=x/);
  assert.match(html, /&lt;script&gt;/);
});

test('loading, error and empty side-panel states render without inventing figures', () => {
  const view = toJudgementView(structuredClone(fixture));
  const loadingHtml = renderLiveDashboard({ judgement: view, combination: loading, documents: loading, plan: loading });
  assert.match(loadingHtml, /조합을 계산하는 중이에요/);
  assert.match(loadingHtml, /서류를 불러오는 중이에요/);
  assert.match(loadingHtml, /일정을 불러오는 중이에요/);

  const errored = renderLiveDashboard({ judgement: view, combination: { state: 'error', message: '네트워크 오류' }, documents: { state: 'error', message: '네트워크 오류' }, plan: { state: 'error' } });
  assert.match(errored, /네트워크 오류/);
  assert.match(errored, /data-combo-retry/);
  assert.match(errored, /data-plan-retry/);

  const emptyHtml = renderLiveDashboard({ judgement: view, combination: { state: 'empty' }, documents: empty, plan: empty });
  assert.match(emptyHtml, /추천할 수 있는 조합이 아직 없어요/);
  assert.match(emptyHtml, /아직 필요한 서류가 없어요/);
  assert.match(emptyHtml, /아직 신청 일정이 없어요/);
});

test('the best combination panel shows the total and members BE returned, flagging estimated amounts', () => {
  const view = toJudgementView(structuredClone(fixture));
  const combination = {
    state: 'ready',
    best: {
      totalKrw: 750000,
      totalIsEstimated: true,
      members: ['면접수당', '구직촉진수당'],
      combination: { total_krw: 750000, total_is_estimated: true, members: [], excluded: [] },
    },
  };
  const html = renderLiveDashboard({ judgement: view, combination, documents: loading, plan: loading });
  assert.match(html, /750,000원/);
  assert.match(html, /일부 금액 미확정/);
  assert.match(html, /<span>면접수당<\/span>/);
  assert.match(html, /<b>\+<\/b><span>구직촉진수당<\/span>/);
});

test('document and schedule panels reflect real BE fields and never claim a check that was not made', () => {
  const view = toJudgementView(structuredClone(fixture));
  const documents = { state: 'ready', items: [
    { name: '주민등록등본', issuer: '정부24', leadTime: 0, requiresVisit: false, masterUnverified: false, checked: true },
    { name: '소득금액증명원', issuer: null, leadTime: 1, requiresVisit: true, masterUnverified: true, checked: false },
  ] };
  const plan = { state: 'ready', items: [{ date: '09.16', title: '면접수당 신청', note: '09.16 마감 · 이때까지 준비 시작' }] };
  const html = renderLiveDashboard({ judgement: view, combination: loading, documents, plan });
  assert.match(html, /check-row checked/);
  assert.match(html, /주민등록등본/);
  assert.match(html, /발급처 확인 필요/);
  assert.match(html, /방문 필요/);
  assert.match(html, /확인 필요/);
  assert.match(html, /2개 중 1개 준비/);
  assert.match(html, /50%/);
  assert.match(html, /면접수당 신청/);
  assert.doesNotMatch(html, /최대\s*\d+만원|D-\d+/);
});
