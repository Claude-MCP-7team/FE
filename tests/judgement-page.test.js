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
