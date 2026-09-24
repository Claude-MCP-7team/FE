import { dashboardTemplate, renderLiveDashboard } from './dashboard-template.js';
import { escape } from './dom.js';
import { chip, confidenceLabels, contactNotice } from './confidence.js';
import { statuses } from './contracts.js';

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

// "최대 혜택 기준" means the highest total across scenarios, not the first
// scenario BE happens to list. Each scenario's combinations are pre-ranked, so
// its own combinations[0] is that scenario's best; compare those across
// scenarios instead of trusting response order (conservative can precede
// maximal and still be picked otherwise).
function bestCombination(response) {
  const candidates = response.scenarios.map(scenario => scenario.combinations[0]).filter(Boolean);
  if (!candidates.length) return null;
  const best = candidates.reduce((top, candidate) => (candidate.total_krw > top.total_krw ? candidate : top));
  return { totalKrw: best.total_krw, totalIsEstimated: best.total_is_estimated, members: best.members.map(member => member.title), combination: best };
}

function documentModel(document, checked) {
  return { name: document.name, issuer: document.issuer, leadTime: document.lead_time_business_days, requiresVisit: document.requires_visit, masterUnverified: document.master_unverified, checked };
}

const dateText = value => (value ? value.replaceAll('-', '.').slice(5) : '확인 필요');
function scheduleModel(plan) {
  const note = plan.recommended_start_date ? `${dateText(plan.deadline_date)} 마감 · 이때까지 준비 시작` : plan.reason || '일정을 확인해 주세요.';
  return { date: dateText(plan.recommended_start_date ?? plan.deadline_date), title: plan.title, note };
}

const conditionStatusClass = { PASS: 'ok', FAIL: 'bad', UNKNOWN: 'ask', FUTURE_PASS: 'ok' };
function detailBody(result) {
  const conditions = result.conditions.map(condition => `<div class="condition"><b>${escape(condition.field)}</b><span class="${conditionStatusClass[condition.status] ?? ''}">${statuses[condition.status].symbol} ${escape(statuses[condition.status].label)}</span><span>${escape(condition.evidence.quote)}${condition.status === 'FUTURE_PASS' && condition.satisfiable_from ? ` · 예상 충족일 ${escape(condition.satisfiable_from)}` : ''}${condition.status === 'FAIL' && condition.permanently_unsatisfiable ? ' · 시간이 지나도 충족할 수 없어요' : ''}</span></div>`).join('') || '<p class="muted">조건 상세가 없어요.</p>';
  const notice = contactNotice(result);
  const contact = notice ? `<div class="source"><b>확인이 필요해요</b><br>${notice}</div>` : '';
  const confidenceText = result.confidence === 'CONFIRMED' ? '확정' : escape(confidenceLabels[result.confidence] ?? result.confidence);
  return `<div class="detail-summary"><div><span>판정 신뢰도</span><strong>${confidenceText}</strong></div><div><span>확인된 조건</span><strong>${result.conditions.length}건</strong></div><div><span>원문 근거</span><strong>${result.conditions.filter(c => c.evidence?.quote).length}건 연결</strong></div></div><h3>조건별 판정과 원문 근거</h3><div class="conditions">${conditions}</div>${contact}`;
}

function comboBody(combination) {
  const members = combination.members.map(member => `<div class="condition"><b>${escape(member.title)}</b><span class="ok">${new Intl.NumberFormat('ko-KR').format(member.estimated_total_krw)}원${member.amount_estimated ? ' (미확정)' : ''}</span><span></span></div>`).join('');
  const excluded = combination.excluded.length
    ? `<div class="source"><b>함께 받을 수 없는 정책</b><br>${combination.excluded.map(item => `${escape(item.title)} — ${escape(item.conflicts_with_title)}와 충돌 ${chip(item.confidence)}`).join('<br>')}</div>`
    : '<div class="source">확인된 충돌 조건이 없어요. 최종 신청 전 각 운영기관 확인을 권장합니다.</div>';
  return `<div class="detail-summary"><div><span>예상 총 혜택</span><strong>${new Intl.NumberFormat('ko-KR').format(combination.total_krw)}원${combination.total_is_estimated ? ' (미확정 포함)' : ''}</strong></div><div><span>조합 정책</span><strong>${combination.members.length}개</strong></div><div><span>제외 정책</span><strong>${combination.excluded.length}개</strong></div></div><div class="conditions">${members}</div>${excluded}`;
}

// Same shell as mountReferenceDashboard, fed by live judgement/combination/plan data
// instead of the fixed demo. Combination and plan load independently of judgement so
// a slow or failed side panel never blocks the policy list the user came here for.
export function mountLiveDashboard(root, { judgement, filter: initialFilter = 'all', profileApi, combinationApi, planApi, onReanalyze, onFilterChange } = {}) {
  const controller = new AbortController();
  const { signal } = controller;
  let filter = initialFilter;
  let combination = { state: 'loading' };
  let documents = { state: 'loading', items: [] };
  let plan = { state: 'loading' };
  const checkedDocuments = new Set();

  const render = () => {
    root.innerHTML = renderLiveDashboard({ judgement, filter, combination, documents, plan });
    bind();
  };

  const openOverlay = id => {
    const overlay = root.querySelector(`#${id}`);
    root.querySelectorAll('.overlay').forEach(el => el.classList.remove('open'));
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    const modal = overlay.querySelector('.modal');
    modal.tabIndex = -1;
    modal.focus({ preventScroll: true });
  };
  const closeOverlays = () => {
    root.querySelectorAll('.overlay').forEach(el => el.classList.remove('open'));
    document.body.style.overflow = '';
  };

  function bind() {
    root.querySelectorAll('[data-reference-filter]').forEach(button => button.addEventListener('click', () => {
      filter = button.dataset.referenceFilter;
      onFilterChange?.(filter);
      render();
    }));
    root.querySelectorAll('.detail-btn').forEach(button => button.addEventListener('click', () => {
      const result = judgement.results.find(item => item.policy_id === button.dataset.policyId);
      if (!result) return;
      root.querySelector('#detailTitle').textContent = result.title?.trim() || result.policy_id;
      root.querySelector('#detailBadge').className = `badge ${{ PASS: 'pass', FAIL: 'fail', UNKNOWN: 'ask', FUTURE_PASS: 'future' }[result.status] ?? 'ask'}`;
      root.querySelector('#detailBadge').textContent = `${statuses[result.status].symbol} ${statuses[result.status].label}`;
      root.querySelector('#detailBody').innerHTML = detailBody(result);
      openOverlay('detailOverlay');
    }));
    root.querySelector('#comboBtn')?.addEventListener('click', () => {
      if (combination.best) { root.querySelector('#comboBody').innerHTML = comboBody(combination.best.combination); openOverlay('comboOverlay'); }
    });
    root.querySelector('#rerun')?.addEventListener('click', () => onReanalyze?.());
    root.querySelectorAll('[data-close], .overlay').forEach(el => el.addEventListener('click', event => {
      if (event.target === el || el.hasAttribute('data-close')) closeOverlays();
    }));
    root.querySelectorAll('[data-document-check]').forEach(input => input.addEventListener('change', () => {
      const index = Number(input.dataset.documentCheck);
      if (input.checked) checkedDocuments.add(index); else checkedDocuments.delete(index);
      documents = { ...documents, items: documents.items.map((item, itemIndex) => itemIndex === index ? { ...item, checked: input.checked } : item) };
      render();
    }));
    root.querySelector('[data-combo-retry]')?.addEventListener('click', loadCombination);
    root.querySelector('[data-plan-retry]')?.addEventListener('click', loadPlan);
  }

  async function loadCombination() {
    combination = { state: 'loading' };
    render();
    try {
      const profile = await profileApi.get();
      if (!profile) throw new Error('저장된 조건이 없어요.');
      const response = await combinationApi.list(profile, { sessionId: profileApi.sessionId, signal });
      if (signal.aborted) return;
      const best = bestCombination(response);
      combination = best ? { state: 'ready', best } : { state: 'empty' };
    } catch (error) {
      if (!signal.aborted) combination = { state: 'error', message: error.message };
    }
    render();
  }

  async function loadPlan() {
    plan = { state: 'loading' };
    documents = { state: 'loading', items: [] };
    render();
    try {
      const profile = await profileApi.get();
      if (!profile) throw new Error('저장된 조건이 없어요.');
      const response = await planApi.list(profile, { sessionId: profileApi.sessionId, signal });
      if (signal.aborted) return;
      plan = { state: 'ready', items: response.plans.map(scheduleModel) };
      documents = { state: 'ready', items: response.documents.map((document, index) => documentModel(document, checkedDocuments.has(index))) };
    } catch (error) {
      if (!signal.aborted) { plan = { state: 'error', message: error.message }; documents = { state: 'error', message: error.message }; }
    }
    render();
  }

  document.addEventListener('keydown', event => {
    const modal = root.querySelector('.overlay.open');
    if (!modal) return;
    if (event.key === 'Escape') { event.preventDefault(); closeOverlays(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...modal.querySelectorAll('button, input, select, a[href]')].filter(el => !el.disabled && el.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modal.querySelector('.modal'))) { event.preventDefault(); first?.focus(); }
  }, { signal });

  render();
  loadCombination();
  loadPlan();
  return { destroy() { controller.abort(); closeOverlays(); } };
}
