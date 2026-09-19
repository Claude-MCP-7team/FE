import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { toJudgementView } from '../src/judgement-contract.js';
import { renderJudgementDashboard, renderJudgementDetail } from '../src/judgement-page.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/judgement.json', import.meta.url), 'utf8'));

test('dashboard renders live verdict counts, confidence and escaped policy identifiers', () => {
  const view = toJudgementView(structuredClone(fixture));
  const html = renderJudgementDashboard(view);
  assert.match(html, /신청 가능<strong>1/);
  assert.match(html, /조건 미충족<strong>1/);
  assert.match(html, /추가 확인<strong>1/);
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
