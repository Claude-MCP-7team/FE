import test from 'node:test';
import assert from 'node:assert/strict';
import { mountProfile } from '../src/profile-form.js';
import { createProfileRepository } from '../src/profile-repository.js';
import { fields } from '../src/profile.js';

// Minimal DOM double for mount/load orchestration, not a browser or layout test.
function element() {
  return { textContent: '', hidden: false, disabled: false, value: '', dataset: {}, firstChild: { textContent: '' },
    listeners: {}, children: [],
    addEventListener(type, listener) { this.listeners[type] = listener; },
    setAttribute() {}, removeAttribute() {}, focus() {},
    replaceChildren() { this.textContent = ''; },
    querySelectorAll() { return []; },
    append(child) { this.children.push(child); },
    after(child) { this.next = child; },
  };
}
function formSurface() {
  const nodes = new Map();
  const get = selector => { if (!nodes.has(selector)) nodes.set(selector, element()); return nodes.get(selector); };
  const controls = new Map(fields.map(key => [key, element()]));
  const form = get('form');
  form.querySelector = get;
  form.querySelectorAll = () => [...controls.values()];
  form.elements = { namedItem: key => controls.get(key) };
  return { container: { querySelector: get }, get };
}

test('remounting the actual form shares a pending read without showing a false failure', async t => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: element };
  t.after(() => { globalThis.document = previousDocument; });
  let resolveRead; let reads = 0;
  const repository = createProfileRepository({ get: () => { reads++; return new Promise(resolve => { resolveRead = resolve; }); } });
  const first = formSurface(); const second = formSurface();
  const mount1 = mountProfile(first.container, { server: true, repository });
  const mount2 = mountProfile(second.container, { server: true, repository });
  assert.equal(reads, 1);
  assert.equal(second.get('#pf-errors').hidden, true);
  assert.equal(second.get('form').elements.namedItem('birth_date').disabled, true);
  resolveRead(null);
  await Promise.all([mount1.ready, mount2.ready]);
  assert.equal(second.get('#pf-errors').hidden, true);
  assert.equal(second.get('#pf-errors').next.hidden, true);
  assert.equal(second.get('form').elements.namedItem('birth_date').disabled, false);
  assert.equal(second.get('#pf-status').textContent, '조건을 입력한 뒤 서버에 저장해 주세요.');
});

test('a genuine shared read failure is visible and the form retry recovers', async t => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: element };
  t.after(() => { globalThis.document = previousDocument; });
  let rejectRead; let reads = 0;
  const repository = createProfileRepository({ get: () => ++reads === 1 ? new Promise((resolve, reject) => { rejectRead = reject; }) : Promise.resolve(null) });
  const first = formSurface(); const second = formSurface();
  const mount1 = mountProfile(first.container, { server: true, repository });
  const mount2 = mountProfile(second.container, { server: true, repository });
  rejectRead(new Error('offline'));
  await Promise.all([mount1.ready, mount2.ready]);
  assert.equal(second.get('#pf-errors').hidden, false);
  const retry = second.get('#pf-errors').next;
  assert.equal(retry.hidden, false);
  assert.equal(second.get('form').elements.namedItem('birth_date').disabled, true);
  await retry.listeners.click();
  assert.equal(reads, 2);
  assert.equal(second.get('#pf-errors').hidden, true);
  assert.equal(retry.hidden, true);
  assert.equal(second.get('form').elements.namedItem('birth_date').disabled, false);
});
