import { choices, emptyProfile, todayLocal, validateProfile, readDraft, saveDraft, removeDraft } from './profile.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const labels = { birth_date: '생년월일', region: '현재 거주지역', residence_start_date: '연속 거주 시작일', education: '학력 상태', employment_status: '취업 상태', employment_type: '근로 형태', personal_income: '개인 월 소득', household_income: '가구 월 소득', household_size: '가구원 수', marital_status: '혼인 상태', policy_history: '기존 정책 참여 이력' };
function field(key, required = false) {
  const hint = ['personal_income', 'household_income'].includes(key) ? '원 단위 · 모르면 비워두세요. 소득이 없으면 0을 입력하세요.' : key === 'household_size' ? '본인을 포함한 인원 · 모르면 비워두세요.' : key === 'residence_start_date' ? '현재 지역에서 중단 없이 거주하기 시작한 날짜예요.' : !required ? '확실하지 않으면 모름 / 미입력을 선택해 주세요.' : '';
  const attrs = `id="pf-${key}" name="${key}" aria-describedby="pf-${key}-hint pf-${key}-error" ${required ? 'required' : ''}`;
  let control;
  if (choices[key]) control = `<select ${attrs}><option value="">${required ? '선택해 주세요' : '모름 / 미입력'}</option>${choices[key].map(([id, text]) => `<option value="${id}">${text}</option>`).join('')}</select>`;
  else if (key.endsWith('date')) control = `<input ${attrs} type="date" min="0001-01-01" max="${todayLocal()}">`;
  else control = `<input ${attrs} type="text" inputmode="numeric" autocomplete="off" placeholder="모르면 비워두세요">`;
  return `<div class="pf-field"><label for="pf-${key}">${labels[key]}${required ? ' <span class="pf-required">(필수)</span>' : ''}</label>${control}<small id="pf-${key}-hint">${hint}</small><span class="pf-error" id="pf-${key}-error"></span></div>`;
}
export function mountProfile(container) {
  container.innerHTML = `<section class="pf-page" aria-labelledby="pf-title"><p class="pf-eyebrow">내 조건 관리</p><h1 id="pf-title">나에게 맞는 정책을 찾기 위한 첫 단계</h1><p class="pf-intro">공통 조건을 먼저 입력해 주세요. 정책별로 필요한 추가 정보는 나중에 확인해요.</p><p class="pf-notice">입력한 조건은 이 탭에만 임시 보관됩니다. 서버 저장·정책 판정은 아직 연결되지 않았어요. 탭을 닫으면 임시 조건이 사라집니다.</p><form id="pf-form" novalidate><div class="pf-errors" id="pf-errors" tabindex="-1" role="alert" hidden></div><fieldset><legend>기본 정보</legend><div class="pf-grid">${field('birth_date', true)}${field('region', true)}${field('residence_start_date', true)}</div></fieldset><fieldset><legend>학업 및 취업</legend><div class="pf-grid">${field('education')}${field('employment_status')}${field('employment_type')}${field('personal_income')}</div></fieldset><fieldset><legend>가구 및 수혜 정보</legend><div class="pf-grid">${field('household_income')}${field('household_size')}${field('marital_status')}${field('policy_history')}</div><p class="pf-footnote">참여 정책과 추가 답변은 정책·질문 목록이 준비되면 선택할 수 있어요. 이름·주민등록번호·상세주소는 입력하지 않습니다.</p></fieldset><div class="pf-actions"><button type="button" id="pf-cancel">수정 취소</button><button type="submit" class="pf-primary">입력 조건 임시 보관</button></div><p id="pf-status" role="status" aria-live="polite"></p><div class="pf-delete"><button type="button" id="pf-delete">임시 조건 삭제</button><span id="pf-confirm" hidden>입력 중인 내용과 임시 조건을 삭제할까요? <button type="button" id="pf-delete-yes">삭제</button><button type="button" id="pf-delete-no">취소</button></span></div></form></section>`;
  const form = container.querySelector('form');
  const status = container.querySelector('#pf-status');
  const errorBox = container.querySelector('#pf-errors');
  let saved = null;
  const populate = value => { for (const [key, val] of Object.entries(value ?? emptyProfile())) form.elements.namedItem(key).value = val ?? ''; };
  const clearErrors = () => {
    errorBox.hidden = true; errorBox.replaceChildren();
    for (const key of Object.keys(labels)) { form.elements.namedItem(key).removeAttribute('aria-invalid'); container.querySelector(`#pf-${key}-error`).textContent = ''; }
  };
  const failure = text => { errorBox.textContent = text; errorBox.hidden = false; errorBox.focus(); status.textContent = ''; };
  try { saved = readDraft(window.sessionStorage); populate(saved); if (saved) status.textContent = '이 탭에 임시 보관한 조건을 불러왔어요. 수정할 수 있습니다.'; }
  catch { failure('임시 조건을 불러오지 못했어요. 새로 입력하거나 임시 조건을 삭제해 주세요.'); }
  form.addEventListener('input', () => { status.textContent = '수정 중이에요. 임시 보관 버튼을 눌러야 변경 내용이 보관됩니다.'; });
  form.addEventListener('submit', event => {
    event.preventDefault(); clearErrors();
    const { value, errors } = validateProfile(Object.fromEntries(new FormData(form)));
    if (Object.keys(errors).length) {
      errorBox.innerHTML = `<strong>입력 내용을 확인해 주세요.</strong><ul>${Object.entries(errors).map(([key, message]) => `<li><a href="#pf-${key}" data-pf-focus="${key}">${escape(labels[key])}: ${escape(message)}</a></li>`).join('')}</ul>`;
      for (const [key, message] of Object.entries(errors)) { form.elements.namedItem(key).setAttribute('aria-invalid', 'true'); container.querySelector(`#pf-${key}-error`).textContent = message; }
      errorBox.hidden = false; errorBox.focus(); status.textContent = ''; return;
    }
    try { saved = saveDraft(window.sessionStorage, value); populate(saved); status.textContent = '이 탭에 조건을 임시 보관했어요. 정책 결과는 예시이며 이 조건으로 재판정되지 않습니다.'; }
    catch { failure('임시 보관에 실패했어요. 브라우저 저장 설정을 확인한 뒤 다시 시도해 주세요. 입력한 내용은 유지됩니다.'); }
  });
  errorBox.addEventListener('click', event => { const link = event.target.closest('[data-pf-focus]'); if (link) { event.preventDefault(); form.elements.namedItem(link.dataset.pfFocus).focus(); } });
  container.querySelector('#pf-cancel').addEventListener('click', () => { populate(saved); clearErrors(); status.textContent = saved ? '마지막으로 임시 보관한 조건으로 되돌렸어요.' : '입력 전 상태로 되돌렸어요.'; });
  const confirm = container.querySelector('#pf-confirm');
  container.querySelector('#pf-delete').addEventListener('click', () => { confirm.hidden = false; container.querySelector('#pf-delete-no').focus(); });
  container.querySelector('#pf-delete-no').addEventListener('click', () => { confirm.hidden = true; container.querySelector('#pf-delete').focus(); });
  container.querySelector('#pf-delete-yes').addEventListener('click', () => {
    try { removeDraft(window.sessionStorage); saved = null; populate(null); clearErrors(); confirm.hidden = true; status.textContent = '이 탭의 임시 조건을 삭제했어요.'; container.querySelector('#pf-delete').focus(); }
    catch { failure('임시 조건을 삭제하지 못했어요. 브라우저 저장 설정을 확인해 주세요.'); }
  });
}
