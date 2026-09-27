import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__YPC_API_BASE__ = 'https://be.test';
const { mountPlan, renderPlanResponse } = await import('../src/plan-page.js');

const baseResponse = { plans: [], documents: [], generated_for_date: '2026-09-19', disclaimer: '', total_document_cost_krw: 0, cost_unknown_document_count: 0 };

test('a fully-known cost never mentions "미상" and never implies a fee document is free', () => {
  const html = renderPlanResponse({ ...baseResponse, documents: [{ name: '기본증명서', cost_krw: 0 }], total_document_cost_krw: 0, cost_unknown_document_count: 0 });
  assert.match(html, /확인된 발급 비용 0원/);
  assert.doesNotMatch(html, /미상/);
  assert.match(html, /발급 비용 0원/);
});

test('an unknown per-school fee is never shown as free, at either the summary or the document level', () => {
  // Same shape BE reported: total_document_cost_krw stays 0 (nothing confirmed) while
  // cost_unknown_document_count says a real, varying fee exists that just isn't summed.
  const html = renderPlanResponse({ ...baseResponse, documents: [{ name: '졸업증명서', cost_krw: null }, { name: '재학증명서', cost_krw: null }], total_document_cost_krw: 0, cost_unknown_document_count: 2 });
  assert.match(html, /확인된 발급 비용 0원 · 금액 미상 서류 2개/);
  // "발급 비용 0원" should only appear once, inside the "확인된 ..." summary line --
  // never again on either document card, which must both read "미상" instead.
  assert.equal((html.match(/발급 비용 0원/g) ?? []).length, 1);
  assert.equal((html.match(/발급 비용 미상/g) ?? []).length, 2);
});

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
