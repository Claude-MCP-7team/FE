import { escape } from './dom.js';

const verdicts = {
  ELIGIBLE: ['신청 가능', 'PASS'],
  INELIGIBLE: ['조건 미충족', 'FAIL'],
  NEEDS_INFO: ['추가 확인', 'UNKNOWN'],
};
const conditionLabels = { PASS: '충족', FAIL: '미충족', UNKNOWN: '확인 필요', FUTURE_PASS: '향후 가능' };
const badge = status => `<span class="badge ${status}">${escape(conditionLabels[status] ?? status)}</span>`;

export function renderJudgementDashboard(view, { onDetail = id => `#/policies/${encodeURIComponent(id)}` } = {}) {
  const summary = view.summary;
  return `<div class="hero"><span class="eyebrow">실제 판정 결과</span><h1>내 조건에 맞는 정책</h1><p class="muted">${escape(view.disclaimer)}</p></div><div class="summary judgement-summary"><article>신청 가능<strong>${summary.eligible}<small>개</small></strong></article><article>조건 미충족<strong>${summary.ineligible}<small>개</small></strong></article><article>추가 확인<strong>${summary.needs_info}<small>개</small></strong></article></div><div class="grid">${view.results.map(result => {
    const [label, style] = verdicts[result.verdict];
    const confidence = result.confidence === 'CONFIRMED' ? '' : `<p class="muted">판정 신뢰도: ${escape(result.confidence)} · 담당부서 확인이 필요합니다.</p>`;
    return `<article class="card judgement-card"><div><span class="badge ${style}">${label}</span>${result.confidence !== 'CONFIRMED' ? ` <span class="badge UNKNOWN">${escape(result.confidence)}</span>` : ''}</div><h2>${escape(result.policy_id)}</h2>${confidence}<p>${escape(result.explanation ?? '정책 조건을 확인해 주세요.')}</p><a class="button" href="${onDetail(result.policy_id)}">판정 근거 보기</a></article>`;
  }).join('') || '<p class="card">표시할 판정 결과가 없습니다.</p>'}</div>`;
}

export function renderJudgementDetail(result) {
  if (!result) return '<div class="state" role="alert"><h1>판정 결과를 찾을 수 없습니다</h1><a class="button" href="#/results">결과로 돌아가기</a></div>';
  const [label, style] = verdicts[result.verdict];
  const conditions = result.conditions.map(condition => `<div class="condition"><h3>${escape(condition.field)} ${badge(condition.status)}</h3><p>${condition.status === 'FUTURE_PASS' && condition.satisfiable_from ? `예상 충족일: ${escape(condition.satisfiable_from)}` : condition.status === 'FAIL' && condition.permanently_unsatisfiable ? '시간이 지나도 충족할 수 없는 조건입니다.' : ''}</p><blockquote>${escape(condition.evidence.quote)}${condition.evidence.url ? `<br><a href="${escape(condition.evidence.url)}" rel="noreferrer">원문 보기</a>` : ''}</blockquote></div>`).join('');
  const contact = result.confidence === 'CONFIRMED' ? '' : `<p class="notice-inline">${escape(result.dept_name)} · ${escape(result.dept_tel)}로 최종 확인해 주세요.</p>`;
  return `<a class="button" href="#/results">← 정책 결과</a><div class="hero"><span class="eyebrow">정책 판정 상세</span><h1>${escape(result.policy_id)}</h1><p>${escape(result.explanation ?? '')}</p></div><section class="card"><p><span class="badge ${style}">${label}</span> <span class="badge ${result.confidence === 'CONFIRMED' ? 'PASS' : 'UNKNOWN'}">${escape(result.confidence)}</span></p>${contact}<h2>조건별 판정과 원문 근거</h2>${conditions || '<p>조건 상세가 없습니다.</p>'}</section>`;
}
