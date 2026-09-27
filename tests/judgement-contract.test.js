import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateJudgementResponse, toJudgementView } from '../src/judgement-contract.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/judgement.json', import.meta.url), 'utf8'));

test('all four condition displays preserve BE policy verdicts, confidence, evidence and individual dates', () => {
  const data = structuredClone(fixture);
  const view = toJudgementView(data);
  assert.deepEqual(data, fixture);
  assert.deepEqual(view.results.flatMap(result => result.conditions.map(condition => condition.status)), ['PASS', 'FUTURE_PASS', 'FAIL', 'UNKNOWN']);
  assert.equal(view.results[1].verdict, 'INELIGIBLE');
  assert.equal(view.results[1].confidence, 'ESTIMATED');
  assert.equal(view.results[1].conditions[0].satisfiable_from, '2027-01-01');
  assert.equal(view.results[1].conditions[1].permanently_unsatisfiable, true);
  assert.equal(view.results[2].confidence, 'NEEDS_REVIEW');
  assert.equal(view.results[2].verdict, 'NEEDS_INFO');
  assert.equal(view.results[2].conditions[0].evidence.url, 'https://example.org/unknown');
  assert.equal(view.results[1].conditions[0].evidence.url, 'https://example.org/residence');
  assert.equal(view.results[2].conditions[0].evidence.quote, fixture.results[2].unknown[0].source_quote);
  assert.equal('future_eligibility_date' in view.results[1], false);
  // The policy status reads BE's future_eligible_from, never the conditions. This
  // policy has a FUTURE_PASS condition but an age cap it can never clear, so BE
  // sends no date and the policy stays FAIL -- promoting it would tell the user
  // to wait for a day that never comes.
  assert.equal(view.results[1].status, 'FAIL');
  assert.equal(view.results[1].conditions.some(condition => condition.status === 'FUTURE_PASS'), true);
  assert.equal(view.results[0].status, 'PASS');
  assert.equal(view.results[2].status, 'UNKNOWN');
  view.results[0].matched[0].source_quote = 'changed';
  assert.deepEqual(data, fixture);
});

test('a dated policy becomes FUTURE_PASS and is counted as a subset of ineligible', () => {
  const dated = structuredClone(fixture);
  dated.results[1].unmatched[1].permanently_unsatisfiable = false;
  dated.results[1].unmatched[1].satisfiable_from = '2028-03-01';
  dated.results[1].future_eligible_from = '2028-03-01';
  dated.summary.future_eligible = 1;
  const view = toJudgementView(dated);
  assert.equal(view.results[1].status, 'FUTURE_PASS');
  // Still ineligible today: the fourth count never leaves the ineligible bucket.
  assert.equal(view.results[1].verdict, 'INELIGIBLE');
  assert.equal(view.summary.ineligible, 1);
  assert.equal(view.summary.future_eligible, 1);
});

test('rejects a future date that contradicts the verdict, the calendar or the summary', () => {
  const reject = change => {
    const data = structuredClone(fixture);
    change(data);
    assert.throws(() => validateJudgementResponse(data), /판정 응답을 확인할 수 없어요/);
  };
  // A date on anything but "ineligible today" would promise a wait that BE never made.
  reject(d => { d.results[0].future_eligible_from = '2028-03-01'; d.summary.future_eligible = 1; });
  reject(d => { d.results[2].future_eligible_from = '2028-03-01'; d.summary.future_eligible = 1; });
  reject(d => { d.results[1].future_eligible_from = '2028-02-30'; d.summary.future_eligible = 1; });
  reject(d => { d.results[1].future_eligible_from = '2028-03'; d.summary.future_eligible = 1; });
  // Count and results must agree, and the subset can never exceed its bucket.
  reject(d => { d.results[1].future_eligible_from = '2028-03-01'; });
  reject(d => { d.summary.future_eligible = 1; });
  reject(d => { d.summary.future_eligible = 2; d.results[1].future_eligible_from = '2028-03-01'; });
  reject(d => { d.results[1].needs_review_fields = ['ok', ' ']; });
  reject(d => { d.results[1].needs_review_fields = 'housing'; });
});

test('rejects missing evidence, duplicate identities, invalid types, dates, counts and missing review contacts', () => {
  const changes = [
    d => { d.results[0].matched[0].source_quote = ' '; },
    d => { d.results[0].matched.push(d.results[0].matched[0]); },
    d => { d.results[1].unknown.push({ rule_id: 'RES', field: 'x', source_quote: 'x' }); },
    d => { d.results[1].policy_id = d.results[0].policy_id; },
    d => { d.results[0].verdict = 'FUTURE_PASS'; },
    d => { d.results[0].confidence = '__proto__'; },
    d => { d.results[0].matched = null; },
    d => { delete d.results[0].matched[0].user_value; },
    d => { d.results[0].matched[0].user_value = { unexpected: true }; },
    d => { d.results[0].matched[0].user_value = [null]; },
    d => { d.results[0].matched[0].user_value = Infinity; },
    d => { delete d.results[1].unmatched[0].required; },
    d => { d.results[1].unmatched[0].satisfiable_from = '2027-02-29'; },
    d => { d.results[1].unmatched[0].satisfiable_from = '0000-01-01'; },
    d => { d.results[1].unmatched[0].permanently_unsatisfiable = true; },
    d => { d.results[1].unmatched[0].time_satisfiable = 'true'; },
    d => { d.results[2].origin_url = null; },
    d => { d.results[0].origin_url = 'javascript:alert(1)'; },
    d => { d.results[1].unmatched[0].source_url = 'data:text/html,x'; },
    d => { d.summary.eligible = 2; },
    d => { d.summary.ineligible = -1; },
    d => { d.disclaimer = ''; },
    d => { d.results = []; },
  ];
  for (const change of changes) {
    const data = structuredClone(fixture); change(data);
    assert.throws(() => validateJudgementResponse(data), e => e.code === 'INVALID_RESPONSE');
  }
});

test('a non-CONFIRMED result with no department contact on file still validates, as long as origin_url is there', () => {
  // Real published policies frequently have no phone/department recorded at all
  // (see docs/HANDOFF.md's dept_tel note) -- only origin_url is guaranteed by BE's builder.
  const data = structuredClone(fixture);
  data.results[1].dept_name = null;
  data.results[1].dept_tel = null;
  data.results[2].dept_name = null;
  data.results[2].dept_tel = '';
  const view = toJudgementView(data);
  assert.equal(view.results[1].dept_tel, null);
  assert.equal(view.results[2].dept_name, null);
});

test('accepts empty results, null source links, zero, false, and valid leap days without inventing missing data', () => {
  const data = structuredClone(fixture);
  data.results[0].matched[0].user_value = 0;
  data.results[0].origin_url = null;
  data.results[1].unmatched[0].user_value = false;
  data.results[1].unmatched[0].required = null;
  data.results[1].unmatched[0].satisfiable_from = '2028-02-29';
  const view = toJudgementView(data);
  assert.equal(view.results[0].conditions[0].user_value, 0);
  assert.equal(view.results[0].conditions[0].evidence.url, null);
  assert.equal(view.results[1].conditions[0].user_value, false);
  assert.equal(view.results[1].conditions[0].required, null);
  data.results = []; data.summary = { eligible: 0, ineligible: 0, needs_info: 0 };
  assert.deepEqual(validateJudgementResponse(data), data);
});
