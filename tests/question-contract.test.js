import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeAnswers, validateQuestionQueue } from '../src/question-contract.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/questions.json', import.meta.url), 'utf8'));

test('validates merged field questions and normalizes only answered values', () => {
  const queue = validateQuestionQueue(structuredClone(fixture));
  assert.equal(queue.questions.length, 3);
  assert.deepEqual(normalizeAnswers(queue.questions, { household_income_ratio_median: '120', similar_program_participation_2y: 'false', education: 'university_graduated', missing: 'ignore' }), { household_income_ratio_median: 120, similar_program_participation_2y: false, education: 'university_graduated' });
  assert.deepEqual(normalizeAnswers(queue.questions, { household_income_ratio_median: '', similar_program_participation_2y: null }), {});
});

test('rejects malformed queue shapes, duplicate fields, invalid choice definitions and unsafe answers', () => {
  const changes = [
    data => { data.questions[0].field = data.questions[1].field; },
    data => { data.questions[0].answer_type = 'date'; },
    data => { data.questions[0].choices = ['unexpected']; },
    data => { data.questions[2].choices.push('middle_or_below'); },
    data => { data.questions[0].resolves = 4; },
    data => { data.questions[0].source_quote = null; },
    data => { data.questions[0].source_policy_ids = ['']; },
    data => { data.total_unresolved_fields = 1; },
    data => { data.questions = null; },
  ];
  for (const change of changes) assert.throws(() => validateQuestionQueue((() => { const copy = structuredClone(fixture); change(copy); return copy; })()), e => e.code === 'INVALID_RESPONSE');
  for (const [input, field] of [[{ household_income_ratio_median: '-1' }, 'household_income_ratio_median'], [{ household_income_ratio_median: '1.2' }, 'household_income_ratio_median'], [{ similar_program_participation_2y: 'maybe' }, 'similar_program_participation_2y'], [{ education: 'other' }, 'education']]) assert.throws(() => normalizeAnswers(fixture.questions, input), e => e.code === 'INVALID_ANSWERS' && e.detail === field);
});
