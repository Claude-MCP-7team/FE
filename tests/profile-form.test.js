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
  // namedItem must return null for a field the markup never rendered (e.g.
  // employment_type in server mode) -- a mock that always hands back a fake
  // control here would hide a real "form.elements.namedItem(key).removeAttribute
  // is not a function on null" crash. rendered starts as "everything" so it
  // doesn't affect tests that never inspect container.innerHTML.
  let rendered = new Set(fields);
  form.elements = { namedItem: key => (rendered.has(key) ? controls.get(key) : null) };
  const container = {
    querySelector: get,
    get innerHTML() { return this._html; },
    set innerHTML(value) { this._html = value; rendered = new Set(fields.filter(key => value.includes(`name="${key}"`))); },
  };
  return { container, get };
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

test('server form exposes confirmed choices and focuses visible field errors before any save request', async t => {
  const previousDocument = globalThis.document;
  const previousFormData = globalThis.FormData;
  globalThis.document = { createElement: element };
  const input = { birth_date: '', region: '41465', residence_start_date: '' };
  globalThis.FormData = class { constructor() { return Object.entries(input); } };
  t.after(() => { globalThis.document = previousDocument; globalThis.FormData = previousFormData; });
  let writes = 0;
  const repository = createProfileRepository({ get: async () => null, upsert: async () => { writes++; } });
  const surface = formSurface();
  await mountProfile(surface.container, { server: true, repository }).ready;
  const html = surface.container.innerHTML;
  assert.match(html, /value="high_school_graduated"/);
  assert.match(html, /value="neet"/);
  assert.match(html, /value="widowed"/);
  assert.doesNotMatch(html, /value="on-leave"/);
  const residenceInput = html.match(/<input[^>]*name="residence_start_date"[^>]*>/)[0];
  assert.match(residenceInput, /type="date"/);
  assert.doesNotMatch(residenceInput, /\brequired\b/);
  const birthInput = html.match(/<input[^>]*name="birth_date"[^>]*>/)[0];
  assert.match(birthInput, /type="date"/);
  assert.match(birthInput, /\brequired\b/);
  await surface.get('form').listeners.submit({ preventDefault() {} });
  assert.equal(writes, 0);
  assert.equal(surface.get('#pf-errors').hidden, false);
  assert.match(surface.get('#pf-errors').innerHTML, /data-pf-focus="birth_date"/);
  assert.match(surface.get('#pf-birth_date-error').textContent, /입력해/);
  let focused = false;
  surface.get('form').elements.namedItem('birth_date').focus = () => { focused = true; };
  surface.get('#pf-errors').listeners.click({ preventDefault() {}, target: { closest: () => ({ dataset: { pfFocus: 'birth_date' } }) } });
  assert.equal(focused, true);
});

test('server form labels district codes precisely and flags preserved broad codes without rewriting them', async t => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: element };
  t.after(() => { globalThis.document = previousDocument; });
  for (const region of ['41465', '41', '00', '11110']) {
    const repository = createProfileRepository({ get: async () => ({ core: { birth_date: '2000-01-01', region_code: region } }) });
    const surface = formSurface();
    await mountProfile(surface.container, { server: true, repository }).ready;
    assert.match(surface.container.innerHTML, /value="41465">경기도 용인시 수지구/);
    assert.match(surface.container.innerHTML, /value="41461">경기도 용인시 처인구/);
    assert.match(surface.container.innerHTML, /value="41463">경기도 용인시 기흥구/);
    assert.doesNotMatch(surface.container.innerHTML, /value="(?:gyeonggi-yongin|gyeonggi-other|other)">/);
    const control = surface.get('form').elements.namedItem('region');
    assert.equal(control.value, region);
    if (region === '41465') assert.equal(control.children.length, 0);
    else {
      assert.equal(control.children[0].value, region);
      assert.match(control.children[0].textContent, /상세 지역 확인 필요/);
    }
  }
});

// employment_type has no BE contract field, so repository.validate() always
// rejects it (see tests/profile-repository.test.js). Rendering it as a normal
// dropdown in server mode was a dead end: any real choice blocked saving with no
// way to tell which field caused it beyond a shared error list. Removed instead,
// matching the already-decided scope in issue #2 (FE#29).
test('the server form omits employment_type entirely -- there is no BE field to save it to', async t => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: element };
  t.after(() => { globalThis.document = previousDocument; });
  const repository = createProfileRepository({ get: async () => null });
  const surface = formSurface();
  await mountProfile(surface.container, { server: true, repository }).ready;
  assert.doesNotMatch(surface.container.innerHTML, /name="employment_type"/);
  assert.doesNotMatch(surface.container.innerHTML, /name="personal_income"/);
  assert.doesNotMatch(surface.container.innerHTML, /name="household_income"/);
  assert.doesNotMatch(surface.container.innerHTML, /name="policy_history"/);
  assert.doesNotMatch(surface.container.innerHTML, /근로 형태/);
});

test('submitting the server form actually saves -- clicking save must not silently no-op because employment_type is gone from the DOM', async t => {
  const previousDocument = globalThis.document;
  const previousFormData = globalThis.FormData;
  globalThis.document = { createElement: element };
  const input = { birth_date: '2000-01-01', region: '41465', residence_start_date: '2020-01-01' };
  globalThis.FormData = class { constructor() { return Object.entries(input); } };
  t.after(() => { globalThis.document = previousDocument; globalThis.FormData = previousFormData; });
  let saved = 0;
  const repository = createProfileRepository({ get: async () => null, upsert: async () => { saved++; } });
  const surface = formSurface();
  await mountProfile(surface.container, { server: true, repository }).ready;
  await surface.get('form').listeners.submit({ preventDefault() {} });
  assert.equal(saved, 1);
  assert.equal(surface.get('#pf-status').textContent, '서버에 조건을 저장했어요. 저장한 조건으로 분석을 시작할 수 있습니다.');
});

test('the draft (mock) form still offers employment_type -- BE contract is not involved there', async t => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: element };
  t.after(() => { globalThis.document = previousDocument; });
  const previousWindow = globalThis.window;
  globalThis.window = { sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  t.after(() => { globalThis.window = previousWindow; });
  const surface = formSurface();
  mountProfile(surface.container, { server: false });
  assert.match(surface.container.innerHTML, /name="employment_type"/);
});
