import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__YPC_API_BASE__ = 'https://be.test';
const { mountCombinations, renderCombinationResponse } = await import('../src/combination-page.js');
const { readFile } = await import('node:fs/promises');
const fixture = JSON.parse(await readFile(new URL('./fixtures/combinations.json', import.meta.url), 'utf8'));

function deferred() {
  let resolve; let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class FakeContainer {
  set innerHTML(value) {
    this.html = value;
    this.retry = value.includes('data-combination-retry') ? { listeners: {}, addEventListener: (event, listener) => { this.retry.listeners[event] = listener; } } : null;
  }
  querySelector(selector) { return selector === '[data-combination-retry]' ? this.retry : null; }
}

test('retry replaces the active combination mount so navigation can cancel it', async () => {
  const container = new FakeContainer(); const pending = deferred(); let gets = 0; let activeMount;
  const profileApi = { sessionId: 'session-1', get: async () => { gets++; if (gets === 1) throw new Error('offline'); return { core: {} }; } };
  const combinationApi = { list: async (_profile, { signal }) => { activeMount.signal = signal; return pending.promise; } };
  mountCombinations(container, { profileApi, combinationApi, onRemount: mount => { activeMount = mount; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(container.retry);
  container.retry.listeners.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(activeMount);
  activeMount.cancel();
  assert.equal(activeMount.signal.aborted, true);
  pending.resolve({ snapshot_version: 'late', eligible_count: 0, scenarios: [], disclaimer: 'late' });
});

test('excluded policies set the announcement quote apart from our own copy', () => {
  const html = renderCombinationResponse(structuredClone(fixture));
  assert.match(html, /<div class="conflict">/);
  // The reason we wrote and the quote the announcement wrote are separate elements.
  assert.match(html, /<p>청년 도약 지원와 함께 받을 수 없어 제외됐어요\.<\/p>/);
  assert.match(html, /<blockquote>동일 기간 중복 수혜 불가/);
  assert.match(html, /href="https:\/\/example\.org\/p-2"/);
  // Exclusion is not a verdict, so it never reuses a status colour.
  assert.doesNotMatch(html, /class="conflict[^"]*(PASS|FAIL|UNKNOWN|FUTURE_PASS)/);
  assert.doesNotMatch(html, /badge (PASS|FAIL|UNKNOWN|FUTURE_PASS)/);
});

test('an estimated conflict says so, a confirmed one stays quiet', () => {
  const confirmed = renderCombinationResponse(structuredClone(fixture));
  assert.doesNotMatch(confirmed, /class="chip"|CONFIRMED/);
  const estimated = structuredClone(fixture);
  estimated.scenarios[0].combinations[0].excluded[0].confidence = 'ESTIMATED';
  const html = renderCombinationResponse(estimated);
  assert.match(html, /<span class="chip">추정 포함<\/span>/);
  assert.doesNotMatch(html, /ESTIMATED/);
});

test('conflict markup escapes response text', () => {
  const hostile = structuredClone(fixture);
  const item = hostile.scenarios[0].combinations[0].excluded[0];
  item.title = '<script>alert(1)</script>';
  item.source_quote = '<img src=x onerror=alert(1)>';
  const html = renderCombinationResponse(hostile);
  // The payloads survive as text; what matters is that no tag brackets do.
  assert.doesNotMatch(html, /<script>alert|<img src=x/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /<blockquote>&lt;img src=x onerror=alert\(1\)&gt;/);
});
