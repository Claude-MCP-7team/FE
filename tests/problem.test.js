import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProblem } from '../src/problem.js';

test('uses RFC 9457 problem type as the stable API error code', () => {
  const problem = parseProblem({ type: '/problems/snapshot-not-ready', title: 'Snapshot unavailable', detail: 'load it first' }, 503);
  assert.deepEqual(problem, { type: '/problems/snapshot-not-ready', code: 'snapshot-not-ready', detail: 'load it first', message: 'load it first' });
});

test('keeps legacy detail and generic HTTP fallback compatible', () => {
  assert.equal(parseProblem({ detail: 'invalid' }, 422).code, 'HTTP_ERROR');
  assert.equal(parseProblem(null, 500).message, '요청에 실패했어요. (500)');
});
