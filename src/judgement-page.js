import { escape } from './dom.js';
import { chip } from './confidence.js';
import { statuses } from './contracts.js';

const verdictBadge = status => `<span class="badge ${status}">${statuses[status].symbol} ${statuses[status].label}</span>`;
// "조건을 충족하는 날"이지 접수 가능일이 아니다. 접수 기간은 공고와 별개다.
const futureFrom = result => result.future_eligible_from
  ? `<p>예상 충족일: <time>${escape(result.future_eligible_from)}</time></p>` : '';
const conditionLabels = { PASS: '충족', FAIL: '미충족', UNKNOWN: '확인 필요', FUTURE_PASS: '향후 가능' };
const confidenceNotes = {
  ESTIMATED: '일부 조건은 추정입니다. 판정 근거를 확인해 주세요.',
  NEEDS_REVIEW: '공고문 근거에 확인이 필요합니다. 담당부서로 문의해 주세요.',
};
// The judge response carries no policy name yet, so policy_id is all we have.
// It is shown as an identifier rather than set in a heading as if it were a name:
// a bare code styled as a title reads as the policy's actual name. Drops away the
// moment BE sends `title`.
const policyName = result => result.title?.trim()
  ? escape(result.title)
  : `<code class="policy-ref">${escape(result.policy_id)}</code>`;
const badge = status => `<span class="badge ${status}">${escape(conditionLabels[status] ?? status)}</span>`;

export function renderJudgementDashboard(view, { filter = 'all', onDetail = id => `#/policies/${encodeURIComponent(id)}` } = {}) {
  const summary = view.summary;
  const futureCount = summary.future_eligible ?? 0;
  const activeFilter = Object.hasOwn(statuses, filter) ? filter : 'all';
  const selected = view.results.filter(result => activeFilter === 'all' || result.status === activeFilter);
  const filters = `<div class="filters" aria-label="판정 상태 필터">${[['all', '전체'], ...Object.entries(statuses).map(([key, value]) => [key, value.label])].map(([key, label]) => `<button data-filter="${key}" aria-pressed="${activeFilter === key}">${label}</button>`).join('')}</div><p role="status">${selected.length}개 정책</p>`;
  return `<div class="hero"><span class="eyebrow">실제 판정 결과</span><h1>내 조건에 맞는 정책</h1><p class="muted">${escape(view.disclaimer)}</p><div class="actions"><a class="button" href="#/profile">조건 수정</a><a class="button" href="#/analysis">다시 분석</a><a class="button" href="#/questions">추가 질문 답하기</a></div></div><div class="summary judgement-summary"><article>${statuses.PASS.label}<strong>${summary.eligible}<small>개</small></strong></article><article>${statuses.FAIL.label}<strong>${summary.ineligible - futureCount}<small>개</small></strong></article><article>${statuses.UNKNOWN.label}<strong>${summary.needs_info}<small>개</small></strong></article><article>${statuses.FUTURE_PASS.label}<strong>${futureCount}<small>개</small></strong></article></div>${filters}<div class="grid">${selected.map(result => {
    const note = confidenceNotes[result.confidence];
    const confidence = note ? `<p class="muted">${note}</p>` : '';
    return `<article class="card judgement-card"><div>${verdictBadge(result.status)} ${chip(result.confidence)}</div><h2>${policyName(result)}</h2>${futureFrom(result)}${confidence}<p>${escape(result.explanation ?? '정책 조건을 확인해 주세요.')}</p><a class="button" href="${onDetail(result.policy_id)}">판정 근거 보기</a></article>`;
  }).join('') || (view.results.length ? '<p class="card">해당 상태의 정책이 없습니다. 다른 필터를 선택하세요.</p>' : '<p class="card">표시할 판정 결과가 없습니다.</p>')}</div>`;
}

export function renderJudgementDetail(result) {
  if (!result) return '<div class="state" role="alert"><h1>판정 결과를 찾을 수 없습니다</h1><a class="button" href="#/results">결과로 돌아가기</a></div>';
  const conditions = result.conditions.map(condition => `<div class="condition"><h3>${escape(condition.field)} ${badge(condition.status)}</h3><p>${condition.status === 'FUTURE_PASS' && condition.satisfiable_from ? `예상 충족일: ${escape(condition.satisfiable_from)}` : condition.status === 'FAIL' && condition.permanently_unsatisfiable ? '시간이 지나도 충족할 수 없는 조건입니다.' : ''}</p><blockquote>${escape(condition.evidence.quote)}${condition.evidence.url ? `<br><a href="${escape(condition.evidence.url)}" rel="noreferrer">원문 보기</a>` : ''}</blockquote></div>`).join('');
  const contact = result.confidence === 'CONFIRMED' ? '' : `<p class="notice-inline">${escape(result.dept_name)} · ${escape(result.dept_tel)}로 최종 확인해 주세요.</p>`;
  return `<a class="button" href="#/results">← 정책 결과</a><div class="hero"><span class="eyebrow">정책 판정 상세</span><h1>${policyName(result)}</h1><p>${escape(result.explanation ?? '')}</p></div><section class="card"><p>${verdictBadge(result.status)} ${chip(result.confidence)}</p>${result.future_eligible_from ? `<p>예상 충족일: <time>${escape(result.future_eligible_from)}</time> · 접수 기간은 공고에서 따로 확인해 주세요.</p>` : ''}${contact}<h2>조건별 판정과 원문 근거</h2>${conditions || '<p>조건 상세가 없습니다.</p>'}</section>`;
}
