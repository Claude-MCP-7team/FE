import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCombinationResponse } from '../src/combination-contract.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/combinations.json', import.meta.url), 'utf8'));

test('validates conservative and maximal combinations with conflict evidence', () => {
  const result = validateCombinationResponse(structuredClone(fixture));
  assert.equal(result.scenarios[0].combinations[0].members[0].policy_id, 'P-1');
  assert.equal(result.scenarios[0].combinations[0].excluded[0].confidence, 'CONFIRMED');
});

test('rejects malformed combination totals, ranks, members and source URLs', () => {
  for (const change of [
    data => { data.eligible_count = -1; },
    data => { data.scenarios[0].kind = 'other'; },
    data => { data.scenarios[0].combinations[0].rank = 0; },
    data => { data.scenarios[0].combinations[0].members = []; },
    data => { data.scenarios[0].combinations[0].excluded[0].source_url = 'javascript:alert(1)'; },
    data => { data.scenarios[0].combinations[0].excluded[0].confidence = 'NEEDS_REVIEW'; },
  ]) assert.throws(() => validateCombinationResponse((() => { const copy = structuredClone(fixture); change(copy); return copy; })()), error => error.code === 'INVALID_RESPONSE');
});
