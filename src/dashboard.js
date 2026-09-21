import { dashboardTemplate } from './dashboard-template.js';

const draftKey = 'ypc.reference-profile.v1';
export const renderReferenceDashboard = () => dashboardTemplate;

// The reference dashboard is the local demo. Live API routes remain in app.js.
export function mountReferenceDashboard(root, { page = 'results' } = {}) {
  const controller = new AbortController();
  const { signal } = controller;
  const find = selector => root.querySelector(selector);
  const all = selector => [...root.querySelectorAll(selector)];
  const form = find('#profileForm');
  const toast = find('#toast');
  let timer;
  let lastFocus;
  let resumeProfile = false;
  let saved = null;
  const message = text => {
    clearTimeout(timer);
    toast.textContent = text;
    toast.classList.add('show');
    timer = setTimeout(() => toast.classList.remove('show'), 3500);
  };
  const updateHero = () => {
    const name = saved?.userName?.trim() || '김유진';
    const title = find('.hero h1');
    title.replaceChildren(document.createTextNode(`${name}님, 받을 수 있는 정책을`), document.createElement('br'), document.createTextNode('실행 계획으로 만들었어요.'));
    document.querySelector('.profile').textContent = name.slice(0, 1);
  };
  const populate = () => {
    form.reset();
    if (saved) for (const [name, value] of Object.entries(saved)) {
      const control = form.elements.namedItem(name);
      if (control && typeof value === 'string') control.value = value;
    }
    updateFields();
  };
  const updateFields = () => {
    const [year, month] = find('#residenceStart').value.split('-').map(Number);
    find('#residenceDuration').textContent = year && month ? `2026년 9월 기준 약 ${Math.max(0, (2026 - year) * 12 + 9 - month)}개월 연속 거주` : '';
    const needsDetail = find('#policyHistory').value === 'yes';
    find('#policyHistoryDetailField').classList.toggle('show', needsDetail);
    find('#policyHistoryDetail').required = needsDetail;
  };
  try {
    const value = JSON.parse(sessionStorage.getItem(draftKey));
    if (value && typeof value === 'object' && !Array.isArray(value)) saved = value;
  } catch { message('이 탭의 예시 입력을 불러오지 못했습니다. 다시 입력해 주세요.'); }
  populate();
  updateHero();
  const close = (navigate = true) => {
    all('.overlay').forEach(el => el.classList.remove('open'));
    document.body.style.overflow = '';
    if (navigate && ['profile', 'questions'].includes(page)) location.hash = '#/results';
    lastFocus?.focus();
  };
  const open = id => {
    const active = find('.overlay.open');
    if (!active) lastFocus = document.activeElement;
    all('.overlay').forEach(el => el.classList.remove('open'));
    const overlay = find(`#${id}`);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    overlay.querySelector('.modal').scrollTop = 0;
    const modal = overlay.querySelector('.modal');
    modal.tabIndex = -1;
    modal.focus({ preventScroll: true });
  };
  const questions = {
    participation: ['최근 2년 동안 정부나 지자체의 청년 취업지원사업에 참여한 적이 있나요?', ['참여한 적 없음', '참여한 적 있음', '잘 모르겠음']],
    vulnerable: ['다음 취약계층 중 해당하는 항목이 있나요?', ['기초생활수급·차상위', '한부모·보호종료', '해당 없음']],
    military: ['현재 병역 상태 또는 복무 이력을 알려주세요.', ['군 복무 완료', '복무 중·예정', '해당 없음']],
    assets: ['가구의 부동산·자동차·금융자산 합계 구간을 알고 있나요?', ['3억원 이하', '3억원 초과', '정확히 모름']],
  };
  const ask = mode => {
    resumeProfile = Boolean(find('#profileOverlay.open'));
    find('#questionText').textContent = questions[mode][0];
    all('.answer').forEach((button, index) => { button.textContent = questions[mode][1][index]; });
    find('#questionSource').textContent = mode === 'participation' ? '이 질문은 공고문의 “최근 2년 내 유사 청년취업지원사업 참여자 제외” 조건을 확인하는 예시입니다.' : '이 조건이 필요한 정책에서만 추가로 확인합니다.';
    open('questionOverlay');
  };
  const filter = value => {
    all('.filter').forEach(button => {
      const active = button.dataset.referenceFilter === value;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    let count = 0;
    all('.policy').forEach(card => {
      const show = value === 'all' || card.dataset.status === value;
      card.classList.toggle('hidden', !show);
      if (show) count++;
    });
    find('#resultCount').textContent = `우선순위가 높은 ${count}개 정책`;
  };
  root.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (event.target.classList.contains('overlay') || target?.hasAttribute('data-close')) {
      if (resumeProfile) { resumeProfile = false; open('profileOverlay'); } else close();
    }
    if (!target) return;
    if (target.id === 'editProfile') { populate(); open('profileOverlay'); }
    if (target.dataset.referenceFilter) filter(target.dataset.referenceFilter);
    if (target.hasAttribute('data-show-all')) filter('all');
    if (target.id === 'openQuestion' || target.classList.contains('ask-detail')) ask('participation');
    if (target.classList.contains('optional-question')) ask(target.dataset.topic);
    if (target.id === 'comboBtn') open('comboOverlay');
    if (target.classList.contains('detail-btn') && !target.classList.contains('ask-detail')) {
      const card = target.closest('.policy');
      find('#detailTitle').textContent = card.dataset.name;
      find('#detailBenefit').textContent = card.querySelector('.amount').textContent;
      open('detailOverlay');
    }
    if (target.classList.contains('answer')) {
      if (resumeProfile) { resumeProfile = false; open('profileOverlay'); } else close();
      message(`선택한 답변: ${target.textContent}. 현재는 예시 화면이며 실제 판정은 실행되지 않습니다.`);
    }
    if (target.id === 'rerun') message('현재는 디자인 예시입니다. 실제 분석은 서버 연결 후 실행됩니다.');
    if (target.id === 'prepareBtn') { close(); find('#documents').scrollIntoView({ behavior: 'smooth' }); }
  }, { signal });
  root.addEventListener('change', event => {
    if (event.target.closest('#profileForm')) updateFields();
    if (event.target.matches('.check-row input')) {
      const checks = all('.check-row input');
      checks.forEach(input => input.closest('.check-row').classList.toggle('checked', input.checked));
      const count = checks.filter(input => input.checked).length;
      const percent = Math.round(count / checks.length * 100);
      find('#docProgress').textContent = `${checks.length}개 중 ${count}개 준비`;
      find('#ringValue').textContent = `${percent}%`;
      find('.progress-ring').style.background = `conic-gradient(var(--green) 0 ${percent}%, var(--mint) ${percent}%)`;
    }
  }, { signal });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const value = Object.fromEntries(new FormData(form));
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(value));
      saved = value;
      updateHero();
      close();
      message('이 탭에 입력을 저장했습니다. 예시 화면으로 실제 재판정은 실행되지 않습니다.');
    } catch { message('저장하지 못했습니다. 입력 내용은 유지됩니다.'); }
  }, { signal });
  document.addEventListener('keydown', event => {
    const modal = find('.overlay.open');
    if (!modal) return;
    if (event.key === 'Escape') { event.preventDefault(); if (resumeProfile) { resumeProfile = false; open('profileOverlay'); } else close(); }
    if (event.key === 'Tab') {
      const controls = [...modal.querySelectorAll('button, input, select, a[href]')].filter(el => !el.disabled && el.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modal.querySelector('.modal'))) { event.preventDefault(); first?.focus(); }
    }
  }, { signal });
  if (page === 'profile') open('profileOverlay');
  if (page === 'questions') ask('participation');
  if (page === 'combinations') find('#combination').scrollIntoView();
  if (page === 'schedule') find('#schedule').scrollIntoView();
  return { destroy() { controller.abort(); clearTimeout(timer); close(false); } };
}
