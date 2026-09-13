import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProfile, validateProfile, todayLocal, readDraft, saveDraft, removeDraft } from '../src/profile.js';
const base = () => ({ ...emptyProfile(), birth_date: '2002-05-12', region: 'gyeonggi-yongin', residence_start_date: '2026-05-01' });
const check = value => validateProfile(value, '2026-09-13');
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), values };
}
test('requires base conditions without inventing optional profile values', () => {
  assert.deepEqual(Object.keys(check(emptyProfile()).errors).sort(), ['birth_date', 'region', 'residence_start_date']);
  const { value, errors } = check(base());
  assert.deepEqual(errors, {});
  for (const key of ['personal_income', 'household_income', 'household_size', 'education', 'policy_history']) assert.equal(value[key], null);
  assert.equal('userName' in value, false);
});
test('rejects calendar errors, future dates and residence before birth', () => {
  for (const date of ['2026-13-01', '2026-02-29', '1900-02-29', '2026-04-31', '0000-01-01', '2026-09-14']) {
    assert.ok(check({ ...base(), birth_date: date }).errors.birth_date, date);
  }
  assert.equal(check({ ...base(), birth_date: '2000-02-29' }).errors.birth_date, undefined);
  assert.ok(check({ ...base(), residence_start_date: '2000-01-01' }).errors.residence_start_date);
  assert.equal(check({ ...base(), residence_start_date: '2026-09-13' }).errors.residence_start_date, undefined);
  assert.equal(todayLocal(new Date(2026, 8, 13, 0, 5)), '2026-09-13');
});
test('keeps unknown income distinct from zero and rejects unsafe numeric input', () => {
  assert.equal(check({ ...base(), personal_income: '0' }).value.personal_income, 0);
  assert.equal(check({ ...base(), personal_income: '  ' }).value.personal_income, null);
  assert.equal(check({ ...base(), personal_income: '12345' }).value.personal_income, 12345);
  for (const key of ['personal_income', 'household_income', 'household_size']) {
    for (const value of ['-1', '1.5', '1e3', '1,000', 'Infinity', '9007199254740992']) assert.ok(check({ ...base(), [key]: value }).errors[key]);
  }
  assert.ok(check({ ...base(), household_size: '0' }).errors.household_size);
});
test('rejects unknown select values and discards unrelated personal information', () => {
  assert.ok(check({ ...base(), employment_status: 'made-up' }).errors.employment_status);
  const { value } = check({ ...base(), full_name: 'private', address: 'private', answers: ['unverified'] });
  assert.equal('full_name' in value || 'address' in value || 'answers' in value, false);
});
test('draft can be saved, reloaded, edited and removed without changing other storage', () => {
  const store = storage(); store.setItem('unrelated', 'keep');
  assert.equal(readDraft(store), null);
  const value = saveDraft(store, { ...base(), personal_income: '0' });
  assert.deepEqual(readDraft(store), value);
  saveDraft(store, { ...value, household_size: '3' });
  assert.equal(readDraft(store).household_size, 3);
  removeDraft(store);
  assert.equal(readDraft(store), null);
  assert.equal(store.getItem('unrelated'), 'keep');
});
test('failed validation or unavailable storage never overwrites a saved draft', () => {
  const store = storage(); const saved = saveDraft(store, base());
  assert.throws(() => saveDraft(store, { ...base(), birth_date: '' }));
  assert.deepEqual(readDraft(store), saved);
  assert.throws(() => readDraft({ getItem() { throw new Error('blocked'); } }));
  assert.throws(() => saveDraft({ setItem() { throw new Error('quota'); } }, base()));
  assert.throws(() => removeDraft({ removeItem() { throw new Error('blocked'); } }));
});
test('rejects corrupt or obsolete saved drafts instead of showing guessed data', () => {
  for (const raw of ['{broken', 'null', '{"version":0}', '{"version":1,"profile":{}}']) assert.throws(() => readDraft({ getItem: () => raw }));
});
