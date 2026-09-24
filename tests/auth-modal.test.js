import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSignupPassword, mountAuthModals } from '../src/auth-modal.js';

test('checkSignupPassword only flags a mismatch', () => {
  assert.equal(checkSignupPassword('secret1', 'secret1'), null);
  assert.equal(checkSignupPassword('secret1', 'secret2'), '비밀번호가 일치하지 않아요.');
});

function classList(initial = []) {
  const set = new Set(initial);
  return { contains: c => set.has(c), add: c => set.add(c), remove: c => set.delete(c) };
}
function fakeButton() {
  const listeners = {};
  return { listeners, addEventListener(type, fn) { listeners[type] = fn; }, click() { listeners.click?.(); } };
}
function fakeModal() { return { tabIndex: 0, focused: false, focus() { this.focused = true; }, querySelectorAll: () => [] }; }
function fakeOverlay() {
  const listeners = {};
  const modal = fakeModal();
  return { classList: classList(), listeners, addEventListener(type, fn) { listeners[type] = fn; }, querySelector: sel => (sel === '.modal' ? modal : null), modal };
}
function fakeField(value = '') { return { value, invalid: false, focused: false, setAttribute() { this.invalid = true; }, removeAttribute() { this.invalid = false; }, focus() { this.focused = true; } }; }
function fakeForm(fields) {
  const listeners = {};
  return { elements: { namedItem: name => fields[name] }, addEventListener(type, fn) { listeners[type] = fn; }, submit() { listeners.submit?.({ preventDefault() {}, target: this }); } };
}

function makeRoot() {
  const loginBtn = fakeButton();
  const signupBtn = fakeButton();
  const loginOverlay = fakeOverlay();
  const signupOverlay = fakeOverlay();
  const toast = { textContent: '', classList: classList() };
  const switchToSignup = fakeButton();
  const switchToLogin = fakeButton();
  const closeButtons = [fakeButton(), fakeButton()];
  const signupPassword = fakeField();
  const signupConfirm = fakeField();
  const confirmError = { textContent: '' };
  const loginForm = fakeForm({ email: fakeField(), password: fakeField() });
  const signupForm = fakeForm({ name: fakeField(), email: fakeField(), password: signupPassword, confirmPassword: signupConfirm });
  const byId = { '#loginBtn': loginBtn, '#signupBtn': signupBtn, '#loginOverlay': loginOverlay, '#signupOverlay': signupOverlay, '#authToast': toast, '#loginForm': loginForm, '#signupForm': signupForm, '#signupConfirmError': confirmError };
  return {
    querySelector: sel => byId[sel] ?? null,
    querySelectorAll: sel => ({ '[data-switch-signup]': [switchToSignup], '[data-switch-login]': [switchToLogin], '[data-auth-close]': closeButtons }[sel] ?? []),
    loginBtn, signupBtn, loginOverlay, signupOverlay, toast, switchToSignup, switchToLogin, closeButtons, loginForm, signupForm, signupConfirm, confirmError,
  };
}

const previousDocument = globalThis.document;
function withFakeDocument(fn) {
  const listeners = {};
  globalThis.document = { body: { style: {} }, activeElement: null, addEventListener(type, handler) { listeners[type] = handler; }, removeEventListener() {} };
  try { fn(listeners); } finally { globalThis.document = previousDocument; }
}

test('the login button opens only the login overlay and locks page scroll', () => withFakeDocument(() => {
  const root = makeRoot();
  mountAuthModals(root);
  root.loginBtn.click();
  assert.equal(root.loginOverlay.classList.contains('open'), true);
  assert.equal(root.signupOverlay.classList.contains('open'), false);
  assert.equal(document.body.style.overflow, 'hidden');
  assert.equal(root.loginOverlay.modal.focused, true);
}));

test('switching from login to signup closes the first overlay', () => withFakeDocument(() => {
  const root = makeRoot();
  mountAuthModals(root);
  root.loginBtn.click();
  root.switchToSignup.click();
  assert.equal(root.loginOverlay.classList.contains('open'), false);
  assert.equal(root.signupOverlay.classList.contains('open'), true);
}));

test('closing restores page scroll', () => withFakeDocument(() => {
  const root = makeRoot();
  mountAuthModals(root);
  root.signupBtn.click();
  root.closeButtons[0].click();
  assert.equal(root.signupOverlay.classList.contains('open'), false);
  assert.equal(document.body.style.overflow, '');
}));

test('Escape closes whichever overlay is open', () => withFakeDocument(listeners => {
  const root = makeRoot();
  mountAuthModals(root);
  root.loginBtn.click();
  listeners.keydown({ key: 'Escape', preventDefault() {} });
  assert.equal(root.loginOverlay.classList.contains('open'), false);
}));

test('submitting the login form is a placeholder: it closes and toasts instead of pretending to sign in', () => withFakeDocument(() => {
  const root = makeRoot();
  mountAuthModals(root);
  root.loginBtn.click();
  root.loginForm.submit();
  assert.equal(root.loginOverlay.classList.contains('open'), false);
  assert.equal(root.toast.classList.contains('show'), true);
  assert.match(root.toast.textContent, /준비 중/);
}));

test('mismatched signup passwords block submission and focus the confirm field instead of closing', () => withFakeDocument(() => {
  const root = makeRoot();
  mountAuthModals(root);
  root.signupBtn.click();
  root.signupForm.elements.namedItem('password').value = 'secret1';
  root.signupConfirm.value = 'secret2';
  root.signupForm.submit();
  assert.equal(root.signupOverlay.classList.contains('open'), true, 'stays open on mismatch');
  assert.equal(root.signupConfirm.invalid, true);
  assert.equal(root.signupConfirm.focused, true);
  assert.equal(root.confirmError.textContent, '비밀번호가 일치하지 않아요.');
  assert.equal(root.toast.classList.contains('show'), false);
}));

test('matching signup passwords close the modal and clear any earlier error', () => withFakeDocument(() => {
  const root = makeRoot();
  mountAuthModals(root);
  root.confirmError.textContent = '비밀번호가 일치하지 않아요.';
  root.signupConfirm.invalid = true;
  root.signupBtn.click();
  root.signupForm.elements.namedItem('password').value = 'secret1';
  root.signupConfirm.value = 'secret1';
  root.signupForm.submit();
  assert.equal(root.signupOverlay.classList.contains('open'), false);
  assert.equal(root.signupConfirm.invalid, false);
  assert.equal(root.confirmError.textContent, '');
  assert.match(root.toast.textContent, /준비 중/);
}));

test('destroy closes any open overlay', () => withFakeDocument(() => {
  const root = makeRoot();
  const mount = mountAuthModals(root);
  root.loginBtn.click();
  mount.destroy();
  assert.equal(root.loginOverlay.classList.contains('open'), false);
}));
