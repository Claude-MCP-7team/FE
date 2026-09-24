// Login/signup are a UI shell only. There is no account backend yet — BE's
// HANDOFF lists auth method (anonymous session vs. login) as an open team
// decision — so submitting either form just closes it and says so, instead
// of pretending to sign a user in.
const passwordMismatch = '비밀번호가 일치하지 않아요.';
export function checkSignupPassword(password, confirmPassword) {
  return password === confirmPassword ? null : passwordMismatch;
}

export function mountAuthModals(root = document) {
  const controller = new AbortController();
  const { signal } = controller;
  const loginOverlay = root.querySelector('#loginOverlay');
  const signupOverlay = root.querySelector('#signupOverlay');
  const overlays = [loginOverlay, signupOverlay].filter(Boolean);
  const toast = root.querySelector('#authToast');
  let lastFocus = null;
  let timer;

  const message = text => {
    if (!toast) return;
    clearTimeout(timer);
    toast.textContent = text;
    toast.classList.add('show');
    timer = setTimeout(() => toast.classList.remove('show'), 3500);
  };
  const closeAll = () => {
    overlays.forEach(overlay => overlay.classList.remove('open'));
    document.body.style.overflow = '';
    lastFocus?.focus();
  };
  const open = overlay => {
    if (!overlay) return;
    lastFocus = document.activeElement;
    closeAll();
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    const modal = overlay.querySelector('.modal');
    modal.tabIndex = -1;
    modal.focus({ preventScroll: true });
  };

  root.querySelector('#loginBtn')?.addEventListener('click', () => open(loginOverlay), { signal });
  root.querySelector('#signupBtn')?.addEventListener('click', () => open(signupOverlay), { signal });
  root.querySelectorAll('[data-switch-signup]').forEach(button => button.addEventListener('click', () => open(signupOverlay), { signal }));
  root.querySelectorAll('[data-switch-login]').forEach(button => button.addEventListener('click', () => open(loginOverlay), { signal }));
  root.querySelectorAll('[data-auth-close]').forEach(button => button.addEventListener('click', closeAll, { signal }));
  overlays.forEach(overlay => overlay.addEventListener('click', event => { if (event.target === overlay) closeAll(); }, { signal }));

  document.addEventListener('keydown', event => {
    const modal = overlays.find(overlay => overlay.classList.contains('open'));
    if (!modal) return;
    if (event.key === 'Escape') { event.preventDefault(); closeAll(); return; }
    if (event.key !== 'Tab') return;
    const box = modal.querySelector('.modal');
    const controls = [...box.querySelectorAll('button, input, select, a[href]')].filter(el => !el.disabled && el.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === box)) { event.preventDefault(); first?.focus(); }
  }, { signal });

  root.querySelector('#loginForm')?.addEventListener('submit', event => {
    event.preventDefault();
    closeAll();
    message('로그인 기능은 아직 준비 중이에요. 백엔드 인증 연동 후 제공될 예정입니다.');
  }, { signal });

  root.querySelector('#signupForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target;
    const confirmField = form.elements.namedItem('confirmPassword');
    const errorBox = root.querySelector('#signupConfirmError');
    const error = checkSignupPassword(form.elements.namedItem('password').value, confirmField.value);
    if (error) {
      confirmField.setAttribute('aria-invalid', 'true');
      if (errorBox) errorBox.textContent = error;
      confirmField.focus();
      return;
    }
    confirmField.removeAttribute('aria-invalid');
    if (errorBox) errorBox.textContent = '';
    closeAll();
    message('회원가입 기능은 아직 준비 중이에요. 백엔드 인증 연동 후 제공될 예정입니다.');
  }, { signal });

  return { destroy() { controller.abort(); closeAll(); } };
}
