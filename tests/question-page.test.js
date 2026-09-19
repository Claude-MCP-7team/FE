import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__YPC_API_BASE__ = 'https://be.test';
const { mountQuestions } = await import('../src/question-page.js');

function deferred() {
  let resolve; let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class FakeContainer {
  set innerHTML(value) {
    this.html = value;
    this.retry = value.includes('data-question-retry') ? { listeners: {}, addEventListener: (event, listener) => { this.retry.listeners[event] = listener; } } : null;
  }

  querySelector(selector) {
    if (selector === '[data-question-retry]') return this.retry;
    return null;
  }
}

test('retry replaces the active mount so navigation can cancel the retried request', async () => {
  const container = new FakeContainer(); const pending = deferred(); let gets = 0; let retryMount;
  const profileApi = { sessionId: 'session-1', get: async () => { gets++; if (gets === 1) throw new Error('offline'); return { answers: {} }; } };
  const questionApi = { list: async (_profile, { signal }) => { retryMount.signal = signal; return pending.promise; } };
  const firstMount = mountQuestions(container, { profileApi, questionApi, onRejudge: async () => {}, onRemount: mount => { retryMount = mount; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(container.retry);
  container.retry.listeners.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.notEqual(retryMount, firstMount);
  retryMount.cancel();
  assert.equal(retryMount.signal.aborted, true);
  pending.resolve({ questions: [] });
});
