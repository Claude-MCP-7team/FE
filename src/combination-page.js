import { escape } from './dom.js';
import { createProfileApi } from './profile-api.js';
import { createCombinationApi } from './combination-api.js';
import { apiBase } from './runtime-config.js';

const money = value => `${new Intl.NumberFormat('ko-KR').format(value)}원`;
function renderCombination(combination) {
  return `<article class="card"><h3>${combination.rank}순위 · ${money(combination.total_krw)}${combination.total_is_estimated ? ' · 추정' : ''}</h3><ul>${combination.members.map(member => `<li><strong>${escape(member.title)}</strong><small> ${money(member.estimated_total_krw)}${member.amount_estimated ? ' (추정)' : ''}</small></li>`).join('')}</ul>${combination.excluded.length ? `<details><summary>제외된 정책 ${combination.excluded.length}개</summary>${combination.excluded.map(item => `<div class="conflict"><strong>${escape(item.title)}</strong><p>${escape(item.conflicts_with_title)}와 함께 받을 수 없어 제외됐어요. ${escape(item.source_quote)}</p>${item.source_url ? `<a href="${escape(item.source_url)}" target="_blank" rel="noreferrer">근거 원문</a>` : ''}</div>`).join('')}</details>` : ''}</article>`;
}
export function renderCombinationResponse(response) {
  if (!response.scenarios.some(scenario => scenario.combinations.length)) return '<section class="card"><h2>추천 가능한 조합이 없어요.</h2><p>현재 적격 정책과 중복수혜 조건을 다시 확인해 주세요.</p></section>';
  return `<div class="hero"><span class="eyebrow">정책 조합 추천</span><h1>함께 받을 수 있는 정책</h1><p class="muted">적격 정책 ${response.eligible_count}개를 중복수혜 조건과 예상 지원액 기준으로 비교했어요.</p></div>${response.scenarios.map(scenario => `<section><h2>${escape(scenario.label)}</h2><p class="muted">${escape(scenario.description)}${scenario.approximate ? ' 일부 금액은 추정치예요.' : ''}</p><div class="grid">${scenario.combinations.map(renderCombination).join('')}</div></section>`).join('')}<p class="muted">${escape(response.disclaimer)}</p>`;
}

export function mountCombinations(container, { profileApi = null, combinationApi = null, onRemount = null } = {}) {
  container.innerHTML = '<div class="state" role="status">추천 조합을 계산하는 중이에요.</div>';
  if (apiBase === null) return { cancel() {} };
  const profiles = profileApi ?? createProfileApi({ baseUrl: apiBase });
  const combinations = combinationApi ?? createCombinationApi({ baseUrl: apiBase });
  const controller = new AbortController();
  (async () => {
    try {
      const profile = await profiles.get();
      if (!profile) throw new Error('저장된 조건이 없어요. 먼저 프로필을 저장해 주세요.');
      const response = await combinations.list(profile, { sessionId: profiles.sessionId, signal: controller.signal });
      if (!controller.signal.aborted) container.innerHTML = renderCombinationResponse(response);
    } catch (error) {
      if (!controller.signal.aborted) {
        container.innerHTML = `<section class="card" role="alert"><h1>추천 조합을 불러오지 못했어요.</h1><p>${escape(error.message)}</p><button data-combination-retry>다시 시도</button></section>`;
        container.querySelector('[data-combination-retry]')?.addEventListener('click', () => {
          const nextMount = mountCombinations(container, { profileApi, combinationApi, onRemount });
          onRemount?.(nextMount);
        });
      }
    }
  })();
  return { cancel: () => controller.abort() };
}
