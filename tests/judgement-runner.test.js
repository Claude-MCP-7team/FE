import test from 'node:test';
import assert from 'node:assert/strict';
import { createJudgementRunner } from '../src/judgement-runner.js';

function deferred() {
  let resolve; let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('publishes loading immediately, prevents duplicate starts, and completes once', async () => {
  const request = deferred(); const states = []; const successes = []; let loads = 0; let calls = 0;
  const runner = createJudgementRunner({
    loadProfile: async () => { loads++; return { core: {} }; },
    judge: async () => { calls++; return request.promise; },
    onLoading: () => states.push('loading'), onSuccess: value => successes.push(value), onError: error => { throw error; },
  });
  const first = runner.start(); const second = runner.start();
  assert.equal(first, second);
  assert.equal(runner.pending, true); assert.deepEqual(states, ['loading']);
  request.resolve({ verdict: 'ok' }); await first;
  assert.equal(runner.pending, false); assert.equal(loads, 1); assert.equal(calls, 1); assert.deepEqual(successes, [{ verdict: 'ok' }]);
});

test('cancel aborts the request, suppresses late success/error, and allows a fresh run', async () => {
  const requests = []; const successes = []; const errors = []; let active = true;
  const runner = createJudgementRunner({
    loadProfile: async () => ({ core: {} }),
    judge: async (profile, { signal }) => { const pending = deferred(); requests.push({ pending, signal }); return pending.promise; },
    onLoading: () => {}, onSuccess: value => successes.push(value), onError: error => errors.push(error), isActive: () => active,
  });
  const first = runner.start(); await Promise.resolve();
  assert.equal(requests.length, 1); assert.equal(runner.cancel(), true); assert.equal(requests[0].signal.aborted, true);
  requests[0].pending.resolve({ stale: true }); await first;
  assert.deepEqual(successes, []); assert.deepEqual(errors, []); assert.equal(runner.pending, false);
  const second = runner.start(); await Promise.resolve(); assert.equal(requests.length, 2);
  requests[1].pending.resolve({ fresh: true }); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(successes, [{ fresh: true }]);
  active = false; assert.equal(runner.cancel(), false);
});

test('screen exit suppresses success and error even when the transport resolves without honoring abort', async () => {
  const pending = deferred(); const errors = []; const successes = []; let active = true;
  const runner = createJudgementRunner({
    loadProfile: async () => ({ core: {} }), judge: async () => pending.promise,
    onLoading: () => {}, onSuccess: value => successes.push(value), onError: error => errors.push(error), isActive: () => active,
  });
  const task = runner.start(); active = false; runner.cancel(); pending.resolve({ late: true }); await task;
  assert.deepEqual(successes, []); assert.deepEqual(errors, []);
});

test('request errors are exposed only while the analysis screen remains active', async () => {
  const errors = []; let active = true;
  const runner = createJudgementRunner({
    loadProfile: async () => ({ core: {} }), judge: async () => { throw new Error('offline'); },
    onLoading: () => {}, onSuccess: () => {}, onError: error => errors.push(error), isActive: () => active,
  });
  await runner.start(); assert.equal(errors.length, 1);
  active = false; await runner.start(); assert.equal(errors.length, 1);
});
