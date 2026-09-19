import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__YPC_API_BASE__ = 'https://be.test';
const { mountPlan } = await import('../src/plan-page.js');

function deferred() { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
class FakeContainer {
  set innerHTML(value) { this.html = value; this.retry = value.includes('data-plan-retry') ? { listeners: {}, addEventListener: (event, listener) => { this.retry.listeners[event] = listener; } } : null; }
  querySelector(selector) { return selector === '[data-plan-retry]' ? this.retry : null; }
  querySelectorAll() { return []; }
}

test('plan retry replaces the active mount so navigation can cancel it', async () => {
  const container = new FakeContainer(); const pending = deferred(); let gets = 0; let activeMount;
  const profileApi = { sessionId: 'session-1', get: async () => { gets++; if (gets === 1) throw new Error('offline'); return { core: {} }; } };
  const planApi = { list: async (_profile, { signal }) => { activeMount.signal = signal; return pending.promise; } };
  mountPlan(container, { profileApi, planApi, onRemount: mount => { activeMount = mount; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(container.retry);
  container.retry.listeners.click();
  await new Promise(resolve => setImmediate(resolve));
  activeMount.cancel();
  assert.equal(activeMount.signal.aborted, true);
  pending.resolve({ plans: [], documents: [], summary: {}, disclaimer: '' });
});
