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
  assert.equal('status' in view.results[1], false);
  view.results[0].matched[0].source_quote = 'changed';
  assert.deepEqual(data, fixture);
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
    d => { d.results[1].dept_tel = null; },
    d => { d.results[2].dept_name = ''; },
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
