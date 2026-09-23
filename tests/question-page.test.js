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

test('answer submission reads enabled controls before disabling them and preserves prior answers', async t => {
  const previous = globalThis.FormData;
  const controls = [{ name: 'similar_program_participation_2y', value: 'false', disabled: false }];
  // Real FormData excludes disabled controls. Model that browser behavior here.
  globalThis.FormData = class { constructor() { return controls.filter(item => !item.disabled).map(item => [item.name, item.value]); } };
  t.after(() => { globalThis.FormData = previous; });
  let submit, stored, rejudged;
  const status = { textContent: '' };
  const form = { dataset: {}, addEventListener: (_event, listener) => { submit = listener; }, querySelector: () => status, querySelectorAll: () => controls };
  const container = { innerHTML: '', querySelector: selector => selector === '#question-form' ? form : null };
  const profile = { core: {}, answers: { existing_answer: 12 } };
  const profileApi = { sessionId: 'test-session', get: async () => profile, put: async next => { stored = next; } };
  const questionApi = { list: async () => ({ questions: [{ field: controls[0].name, answer_type: 'boolean', choices: [], text: '참여 이력이 있나요?', resolves: 1, source_quote: '원문' }] }) };
  mountQuestions(container, { profileApi, questionApi, onRejudge: async next => { rejudged = next; } });
  await new Promise(resolve => setImmediate(resolve));
  await submit({ preventDefault() {} });
  assert.deepEqual(stored.answers, { existing_answer: 12, similar_program_participation_2y: false });
  assert.equal(rejudged, stored);
});
