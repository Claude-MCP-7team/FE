import { choices, serverChoices, emptyProfile, todayLocal, validateProfile, readDraft, saveDraft, removeDraft } from './profile.js';
import { escape } from './dom.js';
import { createProfileApi } from './profile-api.js';
import { createProfileRepository } from './profile-repository.js';
import { apiBase } from './runtime-config.js';
let serverRepository;
const labels = { birth_date: '생년월일', region: '현재 거주지역', residence_start_date: '연속 거주 시작일', education: '학력 상태', employment_status: '취업 상태', employment_type: '근로 형태', personal_income: '개인 월 소득', household_income: '가구 월 소득', household_size: '가구원 수', marital_status: '혼인 상태', policy_history: '기존 정책 참여 이력' };
function renderField(key, required, options, server) {
  const hint = server && ['personal_income', 'household_income', 'employment_type'].includes(key) ? '현재 서버에 저장할 수 없는 항목이에요. 비워두세요.' : server && key === 'policy_history' ? '저장된 참여 이력은 조회만 가능해요. 참여 정책 목록이 준비되면 수정할 수 있어요.' : ['personal_income', 'household_income'].includes(key) ? '원 단위 · 모르면 비워두세요. 소득이 없으면 0을 입력하세요.' : key === 'household_size' ? '본인을 포함한 인원 · 모르면 비워두세요.' : key === 'residence_start_date' ? `현재 지역에서 중단 없이 거주하기 시작한 날짜예요.${server ? ' 모르면 비워두세요.' : ''}` : !required ? '확실하지 않으면 모름 / 미입력을 선택해 주세요.' : '';
  const attrs = `id="pf-${key}" name="${key}" aria-describedby="pf-${key}-hint pf-${key}-error" ${required ? 'required' : ''}`;
  let control;
  if (options[key]) control = `<select ${attrs}><option value="">${required ? '선택해 주세요' : '모름 / 미입력'}</option>${options[key].map(([id, text]) => `<option value="${id}">${text}</option>`).join('')}</select>`;
  else if (key.endsWith('date')) control = `<input ${attrs} type="date" min="0001-01-01" max="${todayLocal()}">`;
  else control = `<input ${attrs} type="text" inputmode="numeric" autocomplete="off" placeholder="모르면 비워두세요">`;
  return `<div class="pf-field"><label for="pf-${key}">${labels[key]}${required ? ' <span class="pf-required">(필수)</span>' : ''}</label>${control}<small id="pf-${key}-hint">${hint}</small><span class="pf-error" id="pf-${key}-error"></span></div>`;
}
export function mountProfile(container, { server = apiBase !== null, repository = null } = {}) {
  const options = server ? serverChoices : choices;
  const field = (key, required = false) => renderField(key, key === 'residence_start_date' && server ? false : required, options, server);
  container.innerHTML = `<section class="pf-page" aria-labelledby="pf-title"><p class="pf-eyebrow">내 조건 관리</p><h1 id="pf-title">나에게 맞는 정책을 찾기 위한 첫 단계</h1><p class="pf-intro">공통 조건을 먼저 입력해 주세요. 정책별로 필요한 추가 정보는 나중에 확인해요.</p><p class="pf-notice">입력한 조건은 이 탭에만 임시 보관됩니다. 서버 저장·정책 판정은 아직 연결되지 않았어요. 탭을 닫으면 임시 조건이 사라집니다.</p><form id="pf-form" novalidate><div class="pf-errors" id="pf-errors" tabindex="-1" role="alert" hidden></div><fieldset><legend>기본 정보</legend><div class="pf-grid">${field('birth_date', true)}${field('region', true)}${field('residence_start_date', true)}</div></fieldset><fieldset><legend>학업 및 취업</legend><div class="pf-grid">${field('education')}${field('employment_status')}${field('employment_type')}${field('personal_income')}</div></fieldset><fieldset><legend>가구 및 수혜 정보</legend><div class="pf-grid">${field('household_income')}${field('household_size')}${field('marital_status')}${field('policy_history')}</div><p class="pf-footnote">참여 정책과 추가 답변은 정책·질문 목록이 준비되면 선택할 수 있어요. 이름·주민등록번호·상세주소는 입력하지 않습니다.</p></fieldset><div class="pf-actions"><button type="button" id="pf-cancel">수정 취소</button><button type="submit" class="pf-primary">입력 조건 임시 보관</button></div><p id="pf-status" role="status" aria-live="polite"></p><div class="pf-delete"><button type="button" id="pf-delete">임시 조건 삭제</button><span id="pf-confirm" hidden>입력 중인 내용과 임시 조건을 삭제할까요? <button type="button" id="pf-delete-yes">삭제</button><button type="button" id="pf-delete-no">취소</button></span></div></form></section>`;
  const form = container.querySelector('form');
  const status = container.querySelector('#pf-status');
  const errorBox = container.querySelector('#pf-errors');
  const submit = form.querySelector('[type="submit"]');
  const retry = document.createElement('button');
  retry.type = 'button'; retry.textContent = '저장된 조건 다시 불러오기'; retry.hidden = true;
  errorBox.after(retry);
  let busy = false;
  let loaded = !server;
  if (server) {
    container.querySelector('.pf-notice').textContent = '입력한 조건을 서버에 저장합니다. 이 탭을 닫으면 저장된 조건에 다시 접근할 수 없으므로, 삭제하려면 탭을 닫기 전에 삭제해 주세요. 정책 결과는 예시이며 자동 재판정되지 않습니다.';
    submit.textContent = '입력 조건 서버 저장';
    container.querySelector('#pf-delete').textContent = '서버 조건 삭제';
    container.querySelector('#pf-confirm').firstChild.textContent = '서버의 조건과 답변을 삭제할까요? ';
    container.querySelector('.pf-footnote').textContent += ' 소득·근로 형태 및 일부 선택지는 아직 서버 저장을 지원하지 않습니다. 기존 정책 참여 이력은 조회만 지원합니다.';
  }
  const setBusy = value => {
    busy = value; form.setAttribute('aria-busy', String(value));
    for (const control of form.querySelectorAll('input, select, button')) control.disabled = value || (server && !loaded && control !== retry && control.id !== 'pf-delete' && control.id !== 'pf-delete-yes' && control.id !== 'pf-delete-no');
  };
  let saved = null;
  const populate = value => {
    for (const [key, val] of Object.entries(value ?? emptyProfile())) {
      const control = form.elements.namedItem(key);
      if (!control) continue;
      control.querySelectorAll('[data-saved-option]').forEach(option => option.remove());
      if (server && options[key] && val && !options[key].some(([id]) => id === val)) {
        const option = document.createElement('option');
        option.value = val; option.textContent = `저장된 값 유지 (${val})`; option.dataset.savedOption = '';
        control.append(option);
      }
      control.value = val ?? '';
    }
  };
  const clearErrors = () => {
    errorBox.hidden = true; errorBox.replaceChildren();
    for (const key of Object.keys(labels)) { form.elements.namedItem(key).removeAttribute('aria-invalid'); container.querySelector(`#pf-${key}-error`).textContent = ''; }
  };
  const failure = text => { errorBox.textContent = text; errorBox.hidden = false; errorBox.focus(); status.textContent = ''; };
  const load = async () => {
    if (busy) return;
    loaded = false; clearErrors(); setBusy(true); status.textContent = '저장된 조건을 불러오는 중이에요.';
    try {
      repository ??= serverRepository ??= createProfileRepository(createProfileApi({ baseUrl: apiBase ?? '' }));
      saved = await repository.loadForForm(); populate(saved); loaded = true; retry.hidden = true;
      status.textContent = saved ? '서버에 저장한 조건을 불러왔어요.' : '조건을 입력한 뒤 서버에 저장해 주세요.';
    } catch { retry.hidden = false; failure('저장된 조건을 불러오지 못했어요. 다시 불러온 뒤 수정해 주세요.'); }
    finally { setBusy(false); }
  };
  retry.addEventListener('click', load);
  const ready = server ? load() : Promise.resolve();
  if (!server) {
    try { saved = readDraft(window.sessionStorage); populate(saved); if (saved) status.textContent = '이 탭에 임시 보관한 조건을 불러왔어요. 수정할 수 있습니다.'; }
    catch { failure('임시 조건을 불러오지 못했어요. 새로 입력하거나 임시 조건을 삭제해 주세요.'); }
  }
  form.addEventListener('input', () => { status.textContent = server ? '수정 중이에요. 서버 저장 버튼을 눌러야 변경 내용이 저장됩니다.' : '수정 중이에요. 임시 보관 버튼을 눌러야 변경 내용이 보관됩니다.'; });
  form.addEventListener('submit', async event => {
    if (busy || !loaded) { event.preventDefault(); return; }
    event.preventDefault(); clearErrors();
    const input = Object.fromEntries(new FormData(form));
    const { value, errors } = server ? repository.validate(input) : validateProfile(input);
    if (Object.keys(errors).length) {
      errorBox.innerHTML = `<strong>입력 내용을 확인해 주세요.</strong><ul>${Object.entries(errors).map(([key, message]) => `<li><a href="#pf-${key}" data-pf-focus="${key}">${escape(labels[key])}: ${escape(message)}</a></li>`).join('')}</ul>`;
      for (const [key, message] of Object.entries(errors)) { form.elements.namedItem(key).setAttribute('aria-invalid', 'true'); container.querySelector(`#pf-${key}-error`).textContent = message; }
      errorBox.hidden = false; errorBox.focus(); status.textContent = ''; return;
    }
    setBusy(true);
    try { saved = server ? await repository.save(value) : saveDraft(window.sessionStorage, value); populate(saved); status.textContent = server ? '서버에 조건을 저장했어요. 정책 결과는 예시이며 자동 재판정되지 않습니다.' : '이 탭에 조건을 임시 보관했어요. 정책 결과는 예시이며 이 조건으로 재판정되지 않습니다.'; }
    catch (error) { failure(server ? (error.code === 'PROFILE_MAPPING_REQUIRED' ? '현재 서버에 저장할 수 없는 항목이 있어요. 소득·근로 형태·정책 참여 이력 또는 선택한 학력·취업·혼인·지역 항목을 확인해 주세요. 입력 내용은 유지됩니다.' : '서버 저장에 실패했어요. 입력 내용은 유지됩니다. 다시 시도해 주세요.') : '임시 보관에 실패했어요. 브라우저 저장 설정을 확인한 뒤 다시 시도해 주세요. 입력한 내용은 유지됩니다.'); }
    finally { setBusy(false); }
  });
  errorBox.addEventListener('click', event => { const link = event.target.closest('[data-pf-focus]'); if (link) { event.preventDefault(); form.elements.namedItem(link.dataset.pfFocus).focus(); } });
  container.querySelector('#pf-cancel').addEventListener('click', () => { populate(saved); clearErrors(); status.textContent = saved ? (server ? '마지막으로 서버에 저장한 조건으로 되돌렸어요.' : '마지막으로 임시 보관한 조건으로 되돌렸어요.') : '입력 전 상태로 되돌렸어요.'; });
  const confirm = container.querySelector('#pf-confirm');
  container.querySelector('#pf-delete').addEventListener('click', () => { confirm.hidden = false; container.querySelector('#pf-delete-no').focus(); });
  container.querySelector('#pf-delete-no').addEventListener('click', () => { confirm.hidden = true; container.querySelector('#pf-delete').focus(); });
  container.querySelector('#pf-delete-yes').addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    try { if (server) { await repository.remove(); loaded = true; retry.hidden = true; } else removeDraft(window.sessionStorage); saved = null; populate(null); clearErrors(); confirm.hidden = true; status.textContent = server ? '서버의 조건과 답변을 삭제했어요.' : '이 탭의 임시 조건을 삭제했어요.'; }
    catch { failure(server ? '서버 삭제에 실패했어요. 조건과 세션을 유지합니다. 다시 시도해 주세요.' : '임시 조건을 삭제하지 못했어요. 브라우저 저장 설정을 확인해 주세요.'); }
    finally { setBusy(false); container.querySelector('#pf-delete').focus(); }
  });
  return { ready };
}
