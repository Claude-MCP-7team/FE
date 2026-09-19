import { escape } from './dom.js';
import { createProfileApi } from './profile-api.js';
import { createPlanApi } from './plan-api.js';
import { apiBase } from './runtime-config.js';

const statusLabels = { URGENT: '지금 준비', ON_TRACK: '준비 가능', ROLLING: '상시 접수', UNKNOWN: '일정 확인 필요', CLOSED: '마감', INFEASIBLE: '기한 내 준비 어려움' };
const dateText = value => value ? value.replaceAll('-', '.') : '확인 필요';
const money = value => `${new Intl.NumberFormat('ko-KR').format(value)}원`;
function documentCard(document, index) {
  return `<article class="card document-card"><h3>${escape(document.name)}${document.master_unverified ? ' · 확인 필요' : ''}</h3><p>${document.issuer ? `발급처: ${escape(document.issuer)}` : '발급처 확인 필요'}${document.lead_time_business_days ? ` · 예상 ${document.lead_time_business_days}영업일` : ''}</p><p>${document.cost_krw ? `발급 비용 ${money(document.cost_krw)}` : '발급 비용 정보 없음'}${document.requires_visit ? ' · 방문 필요' : ''}</p><button type="button" data-document-check="${index}" aria-pressed="false">준비 완료 체크</button></article>`;
}
function planCard(plan) {
  return `<article class="card plan-card"><div class="plan-status ${escape(plan.status)}">${escape(statusLabels[plan.status])}</div><h3>${escape(plan.title)}</h3><p>${escape(plan.reason || '신청 일정을 확인해 주세요.')}</p><dl><dt>준비 시작일</dt><dd>${dateText(plan.recommended_start_date)}</dd><dt>신청 마감일</dt><dd>${dateText(plan.deadline_date)}</dd></dl>${plan.documents.length ? `<p class="muted">필요서류 ${plan.documents.length}개 · 준비 ${plan.preparation_business_days}영업일</p>` : ''}${plan.origin_url ? `<a href="${escape(plan.origin_url)}" target="_blank" rel="noreferrer">공고 원문 보기</a>` : ''}</article>`;
}
export function renderPlanResponse(response) {
  if (!response.plans.length && !response.documents.length) return '<section class="card"><h2>표시할 신청 계획이 없어요.</h2><p>현재 신청 가능한 정책의 서류와 일정이 없습니다.</p></section>';
  return `<div class="hero"><span class="eyebrow">신청 준비 계획</span><h1>서류와 일정을 한눈에</h1><p class="muted">기준일 ${dateText(response.generated_for_date)} · ${escape(response.disclaimer)}</p></div><section><h2>신청 일정</h2><div class="grid">${response.plans.map(planCard).join('')}</div></section><section><h2>공통 필요서류</h2><p class="muted">총 ${response.documents.length}개 · 예상 발급 비용 ${money(response.total_document_cost_krw)}</p><div class="grid">${response.documents.map(documentCard).join('')}</div></section>`;
}

export function mountPlan(container, { profileApi = null, planApi = null, onRemount = null } = {}) {
  container.innerHTML = '<div class="state" role="status">신청 계획을 계산하는 중이에요.</div>';
  if (apiBase === null) return { cancel() {} };
  const profiles = profileApi ?? createProfileApi({ baseUrl: apiBase });
  const plans = planApi ?? createPlanApi({ baseUrl: apiBase });
  const controller = new AbortController();
  (async () => {
    try {
      const profile = await profiles.get();
      if (!profile) throw new Error('저장된 조건이 없어요. 먼저 프로필을 저장해 주세요.');
      const response = await plans.list(profile, { sessionId: profiles.sessionId, signal: controller.signal });
      if (controller.signal.aborted) return;
      container.innerHTML = renderPlanResponse(response);
      container.querySelectorAll('[data-document-check]').forEach(button => button.addEventListener('click', () => {
        const checked = button.getAttribute('aria-pressed') === 'true';
        button.setAttribute('aria-pressed', String(!checked)); button.textContent = checked ? '준비 완료 체크' : '준비 완료';
      }));
    } catch (error) {
      if (!controller.signal.aborted) {
        container.innerHTML = `<section class="card" role="alert"><h1>신청 계획을 불러오지 못했어요.</h1><p>${escape(error.message)}</p><button data-plan-retry>다시 시도</button></section>`;
        container.querySelector('[data-plan-retry]')?.addEventListener('click', () => { const nextMount = mountPlan(container, { profileApi, planApi, onRemount }); onRemount?.(nextMount); });
      }
    }
  })();
  return { cancel: () => controller.abort() };
}
