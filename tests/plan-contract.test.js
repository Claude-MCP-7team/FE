import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatePlanResponse } from '../src/plan-contract.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/plan.json', import.meta.url), 'utf8'));

test('validates plan dates, documents and timeline metadata', () => {
  const result = validatePlanResponse(structuredClone(fixture));
  assert.equal(result.plans[0].documents[0].issuer, '정부24');
  assert.equal(result.documents[0].needed_by_date, '2026-09-25');
});

test('rejects invalid plan statuses, dates and document references', () => {
  for (const change of [
    data => { data.plans[0].status = 'READY'; },
    data => { data.plans[0].deadline_date = '2026-02-30'; },
    data => { data.documents[0].lead_time_business_days = -1; },
    data => { data.documents[0].required_by = ['']; },
    data => { data.plans[0].origin_url = 'javascript:alert(1)'; },
]) assert.throws(() => validatePlanResponse((() => { const copy = structuredClone(fixture); change(copy); return copy; })()), error => error.code === 'INVALID_RESPONSE');
});

test('an INFEASIBLE plan can report negative slack, but the day counts it is built from stay non-negative', () => {
  // slack_business_days is signed: it is how many business days short (or to spare) a
  // plan is, so a plan that is already behind reports a negative number rather than
  // clamping at 0 (see docs/HANDOFF.md's slack_business_days note).
  const short = structuredClone(fixture);
  short.plans[0].slack_business_days = -1;
  assert.equal(validatePlanResponse(short).plans[0].slack_business_days, -1);
  for (const key of ['business_days_to_deadline', 'preparation_business_days']) {
    const invalid = structuredClone(fixture);
    invalid.plans[0][key] = -1;
    assert.throws(() => validatePlanResponse(invalid), error => error.code === 'INVALID_RESPONSE');
  }
});

test('rejects summary counts that do not match plans', () => {
  const data = structuredClone(fixture);
  data.summary.on_track = 0;
  assert.throws(() => validatePlanResponse(data), error => error.code === 'INVALID_RESPONSE' && error.detail === 'summary.on_track');
});
