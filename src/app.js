import { statuses, validateFixture, parseRoute } from './contracts.js';
import { mountProfile } from './profile-form.js';
const main = document.querySelector('main');
let data;
let filter = 'all';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const badge = status => `<span class="badge ${status}">${statuses[status].symbol} ${statuses[status].label}</span>`;
const link = (href, text) => `<a class="button" href="#/${href}">${text}</a>`;
const heading = (title, description) => `<div class="hero"><span class="eyebrow">나에게 맞는 다음 단계</span><h1>${title}</h1><p class="muted">${description}</p></div>`;
const policy = id => data.policies.find(p => p.policy_id === id);
function results() {
  const selected = data.results.filter(result => filter === 'all' || result.status === filter);
  return heading('청년정책, 가능성부터 실행까지', '내 조건에 따른 결과와 이유를 확인하는 화면입니다. 기준일: 2026-09-12 · 예시 프로필') +
    `<div class="summary">${Object.entries(statuses).map(([key, value]) => `<article>${value.label}<strong>${data.results.filter(r => r.status === key).length}<small>개</small></strong></article>`).join('')}</div>` +
    `<div class="filters" aria-label="판정 상태 필터">${[['all', '전체'], ...Object.entries(statuses).map(([key, value]) => [key, value.label])].map(([key, label]) => `<button data-filter="${key}" aria-pressed="${filter === key}">${label}</button>`).join('')}</div><p role="status">${selected.length}개 정책</p><div class="grid">${selected.map(result => {
      const p = policy(result.policy_id);
      return `<article class="card">${badge(result.status)}<h2>${escape(p.name)}</h2><p class="muted">${escape(p.organization)}</p><p class="benefit">${escape(p.benefit)}</p><p>${escape(result.reason)}</p>${result.future_eligibility_date ? `<p>향후 조건 충족 예상일: <time>${escape(result.future_eligibility_date)}</time></p>` : ''}${link(`policies/${encodeURIComponent(p.policy_id)}`, '판정 근거 보기')}</article>`;
    }).join('') || '<p class="card">해당 상태의 정책이 없습니다. 다른 필터를 선택하세요.</p>'}</div>`;
}
function detail(id) {
  const p = policy(id), result = data.results.find(r => r.policy_id === id);
  if (!p || !result) return missing();
  return link('results', '← 정책 결과') + heading(escape(p.name), escape(p.description)) + `<section class="card">${badge(result.status)}<p class="benefit">${escape(p.benefit)}</p><p>${escape(result.reason)}</p>${result.future_eligibility_date ? `<p>향후 조건 충족 예상일: ${escape(result.future_eligibility_date)} (접수 가능 여부는 별도 확인)</p>` : ''}<h2>조건별 판정과 공고문 근거</h2>${result.conditions.map(c => `<div class="condition"><h3>${escape(c.name)} ${badge(c.status)}</h3><p>${escape(c.reason)}</p><blockquote>${escape(c.evidence.quote)}<br><small>가상 공고문 p.${escape(c.evidence.page)} · 실제 원문 연결 전</small></blockquote></div>`).join('')}<div class="actions">${result.status === 'UNKNOWN' ? link('questions', '추가 질문 확인') : ''}${link('schedule', '신청 준비 예시')}</div></section>`;
}
function profile() {
  return '<div id="profile-content"></div>';
}
function questions() {
  return heading('판정에 필요한 추가 질문', 'UNKNOWN 상태에서는 확인되지 않은 답변을 임의로 판정하지 않습니다.') + data.questions.map(q => `<section class="card"><p class="muted">${escape(policy(q.policy_id).name)}</p><h2>${escape(q.text)}</h2><fieldset disabled><legend>답변 예시 · M3 연결 예정</legend><select aria-label="참여 이력"><option>답변을 선택하세요</option><option>예</option><option>아니오</option><option>잘 모르겠음</option></select></fieldset><p>답변 제출 → 재판정 중 → 갱신된 결과 순서로 연결할 예정입니다.</p></section>`).join('');
}
function combinations() {
  return heading('함께 받을 수 있는 정책', '중복수혜 여부와 충돌 사유를 비교하는 화면 예시입니다.') + `<section class="card">${badge(data.combination.compatibility)}<h2>검토 중인 조합</h2><ul>${data.combination.policy_ids.map(id => `<li>${escape(policy(id).name)}</li>`).join('')}</ul>${data.combination.conflicts.map(c => `<p>${escape(c.reason)}</p>`).join('')}<p class="muted">중복수혜 확인 전에는 수혜 가능 조합이나 총 혜택을 확정하지 않습니다.</p>${link('schedule', '서류·일정 보기')}</section>`;
}
function schedule() {
  return heading('신청 준비를 한눈에', '필요서류와 신청 일정을 연결하는 화면 예시입니다.') + `<div class="grid"><section class="card"><h2>필요서류</h2>${data.documents.map(d => `<h3>${escape(d.name)} · ${d.required ? '필수' : '선택'}</h3><p>${escape(policy(d.policy_id).name)}</p><p>발급처: ${escape(d.issuer)} / 예상 ${d.estimated_days}일</p><button disabled>준비 완료 체크 · M4 연결 예정</button>`).join('')}</section><section class="card"><h2>신청 타임라인</h2>${data.schedules.map(s => `<h3>${escape(policy(s.policy_id).name)}</h3><dl><dt>준비 시작일</dt><dd>${escape(s.preparation_date)}</dd><dt>권장 신청일</dt><dd>${escape(s.recommended_date)}</dd><dt>마감일</dt><dd>${escape(s.deadline)}</dd></dl>`).join('')}</section></div>`;
}
function missing() { return heading('화면을 찾을 수 없습니다', '주소를 확인하거나 정책 결과로 돌아가세요.') + link('results', '정책 결과로'); }
function render() {
  if (!data) return;
  const { page, id } = parseRoute(location.hash);
  const pages = { results, profile, questions, combinations, schedule, policies: () => detail(id), analysis: () => heading('분석을 시작할 준비가 되었어요', '프로필 저장 → 분석 요청 → 결과 조회 순서입니다. 현재 실제 분석은 연결되지 않았습니다.') + link('results', 'Mock 결과 보기') };
  main.innerHTML = (Object.hasOwn(pages, page) ? pages[page] : missing)();
  if (page === 'profile') mountProfile(main.querySelector('#profile-content'));
  document.querySelectorAll('nav a').forEach(a => { if (a.hash === `#/${page}`) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.title = `${main.querySelector('h1')?.textContent ?? '정책 결과'} · YouthFit AI`;
}
async function load() {
  main.innerHTML = '<div class="state" role="status">예시 정책 데이터를 불러오고 있습니다…</div>';
  try {
    const response = await fetch('/mocks/scenario.json');
    if (!response.ok) throw new Error('Mock 데이터를 불러오지 못했습니다.');
    data = validateFixture(await response.json());
    render();
  } catch {
    main.innerHTML = '<div class="state" role="alert"><h1>데이터를 불러오지 못했어요</h1><p>개발 서버와 Mock 파일을 확인한 뒤 다시 시도하세요.</p><button data-retry>다시 시도</button></div>';
  }
}
main.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (target?.dataset.filter) { filter = target.dataset.filter; render(); main.querySelector(`[data-filter="${filter}"]`).focus(); }
  if (target?.hasAttribute('data-retry')) load();
});
window.addEventListener('hashchange', () => { render(); main.focus(); window.scrollTo(0, 0); });
load();
