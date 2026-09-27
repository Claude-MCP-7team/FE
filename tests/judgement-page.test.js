import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { toJudgementView } from '../src/judgement-contract.js';
import { renderJudgementDashboard, renderJudgementDetail } from '../src/judgement-page.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/judgement.json', import.meta.url), 'utf8'));

test('live filters select policy status without changing summary totals', () => {
  const view = toJudgementView(structuredClone(fixture));
  for (const filter of ['PASS', 'FAIL', 'UNKNOWN']) {
    const html = renderJudgementDashboard(view, { filter });
    const expected = view.results.filter(result => result.status === filter);
    assert.equal(expected.length, 1);
    assert.match(html, new RegExp(`data-filter="${filter}" aria-pressed="true"`));
    assert.match(html, /role="status">1개 정책/);
    for (const result of view.results) {
      assert.equal(html.includes(`href="#/policies/${result.policy_id}"`), result.status === filter);
    }
    assert.match(html, /신청 가능<strong>1/);
    assert.match(html, /조건 미충족<strong>1/);
    assert.match(html, /추가 확인<strong>1/);
  }
  const missing = renderJudgementDashboard(view, { filter: 'FUTURE_PASS' });
  assert.match(missing, /해당 상태의 정책이 없습니다/);
  assert.match(missing, /role="status">0개 정책/);
  const fallback = renderJudgementDashboard(view, { filter: 'not-a-status' });
  assert.match(fallback, /data-filter="all" aria-pressed="true"/);
  assert.match(fallback, /role="status">3개 정책/);
});

test('future filter uses the policy date, not a future condition on a failed policy', () => {
  const response = structuredClone(fixture);
  const undated = toJudgementView(response);
  assert.match(renderJudgementDashboard(undated, { filter: 'FUTURE_PASS' }), /0개 정책/);
  response.results[1].unmatched[1].permanently_unsatisfiable = false;
  response.results[1].unmatched[1].satisfiable_from = '2028-03-01';
  response.results[1].future_eligible_from = '2028-03-01';
  response.summary.future_eligible = 1;
  const dated = toJudgementView(response);
  assert.match(renderJudgementDashboard(dated, { filter: 'FUTURE_PASS' }), /href="#\/policies\/TEST-INELIGIBLE"/);
  assert.doesNotMatch(renderJudgementDashboard(dated, { filter: 'FAIL' }), /href="#\/policies\/TEST-INELIGIBLE"/);
});

test('dashboard renders live verdict counts, confidence and escaped policy identifiers', () => {
  const view = toJudgementView(structuredClone(fixture));
  const html = renderJudgementDashboard(view);
  assert.match(html, /신청 가능<strong>1/);
  assert.match(html, /조건 미충족<strong>1/);
  assert.match(html, /추가 확인<strong>1/);
  assert.match(html, /향후 가능<strong>0/);
  assert.match(html, /TEST-INELIGIBLE/);
  // Confidence uses a neutral chip, never a status colour, and never the raw enum.
  assert.match(html, /<span class="chip">추정 포함<\/span>/);
  assert.match(html, /일부 조건은 추정입니다/);
  assert.doesNotMatch(html, /ESTIMATED|NEEDS_REVIEW|CONFIRMED/);
  assert.doesNotMatch(html, /badge (PASS|FAIL|UNKNOWN|FUTURE_PASS)">(추정|담당부서|확인)/);
  assert.doesNotMatch(html, /future_eligibility_date/);
});

test('detail renders four condition states, evidence links and review contact without trusting response HTML', () => {
  const view = toJudgementView(structuredClone(fixture));
  const html = renderJudgementDetail(view.results[1]);
  assert.match(html, /향후 가능/);
  assert.match(html, /조건 미충족/);
  assert.match(html, /예상 충족일: 2027-01-01/);
  assert.match(html, /시간이 지나도 충족할 수 없는 조건입니다/);
  assert.match(html, /https:\/\/example\.org\/residence/);
  assert.match(html, /테스트 부서/);
  assert.match(html, /<span class="chip">추정 포함<\/span>/);
  assert.doesNotMatch(html, /ESTIMATED/);
  // NEEDS_REVIEW gets its own wording, still on the neutral chip.
  const review = renderJudgementDetail(view.results[2]);
  assert.match(review, /<span class="chip">담당부서 확인<\/span>/);
  assert.doesNotMatch(review, /NEEDS_REVIEW/);
  const malicious = structuredClone(view.results[2]);
  malicious.explanation = '<img src=x onerror=alert(1)>';
  malicious.policy_id = '<script>alert(1)</script>';
  const safe = renderJudgementDetail(malicious);
  assert.doesNotMatch(safe, /<script>alert/);
  assert.match(safe, /&lt;script&gt;/);
});

test('unknown detail and empty dashboard are explicit states', () => {
  assert.match(renderJudgementDetail(null), /판정 결과를 찾을 수 없습니다/);
  const empty = structuredClone(fixture); empty.results = []; empty.summary = { eligible: 0, ineligible: 0, needs_info: 0 };
  assert.match(renderJudgementDashboard(toJudgementView(empty)), /표시할 판정 결과가 없습니다/);
});

test('a policy name is shown when BE sends one, an identifier when it does not', () => {
  const withoutTitle = toJudgementView(structuredClone(fixture));
  const bare = renderJudgementDashboard(withoutTitle);
  // No name available: the id is marked as an identifier, never set as a plain heading.
  assert.match(bare, /<h2><code class="policy-ref">TEST-ELIGIBLE<\/code><\/h2>/);

  const named = structuredClone(fixture);
  named.results[0].title = '청년 도약 지원';
  const html = renderJudgementDashboard(toJudgementView(named));
  assert.match(html, /<h2>청년 도약 지원<\/h2>/);
  assert.doesNotMatch(html, /<h2><code class="policy-ref">TEST-ELIGIBLE/);
  // The link still targets the id, which is what the route needs.
  assert.match(html, /href="#\/policies\/TEST-ELIGIBLE"/);
});

test('a blank or hostile title falls back and never injects markup', () => {
  const blank = structuredClone(fixture);
  blank.results[0].title = '   ';
  assert.match(renderJudgementDashboard(toJudgementView(blank)), /<code class="policy-ref">TEST-ELIGIBLE<\/code>/);

  const hostile = structuredClone(fixture);
  hostile.results[0].title = '<script>alert(1)</script>';
  const html = renderJudgementDashboard(toJudgementView(hostile));
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('a non-string title is rejected rather than rendered', () => {
  const wrong = structuredClone(fixture);
  wrong.results[0].title = 42;
  assert.throws(() => toJudgementView(wrong), /판정 응답을 확인할 수 없어요/);
});

test('the fourth tile takes its count out of the ineligible tile, not on top of it', () => {
  const dated = structuredClone(fixture);
  dated.results[1].unmatched[1].permanently_unsatisfiable = false;
  dated.results[1].unmatched[1].satisfiable_from = '2028-03-01';
  dated.results[1].future_eligible_from = '2028-03-01';
  dated.summary.future_eligible = 1;
  const html = renderJudgementDashboard(toJudgementView(dated));
  // The one ineligible policy is the dated one, so it shows up once, under 향후 가능.
  assert.match(html, /조건 미충족<strong>0/);
  assert.match(html, /향후 가능<strong>1/);
  const tiles = [...html.matchAll(/<strong>(\d+)<small>/g)].map(match => Number(match[1]));
  assert.deepEqual(tiles, [1, 0, 1, 1]);
  assert.equal(tiles.reduce((sum, value) => sum + value, 0), dated.results.length);
});

test('a future policy carries the FUTURE_PASS badge and its date, never framed as an intake day', () => {
  const dated = structuredClone(fixture);
  dated.results[1].unmatched[1].permanently_unsatisfiable = false;
  dated.results[1].unmatched[1].satisfiable_from = '2028-03-01';
  dated.results[1].future_eligible_from = '2028-03-01';
  dated.summary.future_eligible = 1;
  const view = toJudgementView(dated);
  const card = renderJudgementDashboard(view);
  assert.match(card, /<span class="badge FUTURE_PASS">↗ 향후 가능<\/span>/);
  assert.match(card, /예상 충족일: <time>2028-03-01<\/time>/);
  const detail = renderJudgementDetail(view.results[1]);
  assert.match(detail, /접수 기간은 공고에서 따로 확인해 주세요/);
  assert.doesNotMatch(detail, /접수 가능일|신청 가능일/);
});

test('a policy whose condition alone is future-dated is not promoted', () => {
  const view = toJudgementView(structuredClone(fixture));
  const html = renderJudgementDashboard(view);
  // results[1] has a FUTURE_PASS condition but an age cap, so BE sends no date.
  assert.match(html, /<span class="badge FAIL">× 조건 미충족<\/span>/);
  assert.doesNotMatch(html, /badge FUTURE_PASS/);
  assert.doesNotMatch(html, /예상 충족일/);
});
