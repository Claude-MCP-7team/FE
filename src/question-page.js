import { escape } from './dom.js';
import { createProfileApi } from './profile-api.js';
import { createQuestionApi } from './question-api.js';
import { normalizeAnswers } from './question-contract.js';
import { apiBase } from './runtime-config.js';

const labels = { boolean: [['', '답변을 선택하세요'], ['true', '예'], ['false', '아니오']], choice: [['', '선택해 주세요']] };
function control(question) {
  if (question.answer_type === 'number') return `<input name="${escape(question.field)}" type="number" min="0" step="1" inputmode="numeric" placeholder="모르면 비워두세요">`;
  const options = question.answer_type === 'boolean' ? labels.boolean : [...labels.choice, ...question.choices.map(choice => [choice, choice])];
  return `<select name="${escape(question.field)}">${options.map(([value, label]) => `<option value="${escape(value)}">${escape(label)}</option>`).join('')}</select>`;
}
function renderQueue(queue) {
  if (!queue.questions.length) return '<section class="card"><h2>추가로 확인할 질문이 없습니다.</h2><p>현재 조건으로 판정을 진행할 수 있습니다.</p><a class="button" href="#/analysis">분석 결과로 돌아가기</a></section>';
  return `<form id="question-form"><p class="muted">답변하면 판정이 끝나는 정책 수만 표시합니다. 모르는 질문은 비워둘 수 있어요.</p>${queue.questions.map(question => `<section class="card question-card"><label for="question-${escape(question.field)}"><h2>${escape(question.text)}</h2><small>${question.resolves}개 정책의 판정이 완료될 수 있어요.</small></label><div><label for="question-${escape(question.field)}">답변</label>${control(question).replace('<input ', `<input id="question-${escape(question.field)}" `).replace('<select ', `<select id="question-${escape(question.field)}" `)}</div><blockquote>${escape(question.source_quote)}</blockquote></section>`).join('')}<button class="primary" type="submit">답변 저장하고 재판정</button><p id="question-status" role="status" aria-live="polite"></p></form>`;
}

export function mountQuestions(container, { onRejudge, profileApi = null, questionApi = null } = {}) {
  container.innerHTML = '<div class="state" role="status">판정에 필요한 질문을 불러오는 중이에요…</div>';
  if (apiBase === null) { container.innerHTML = '<section class="card"><h1>실제 질문은 서버 연결 후 제공됩니다.</h1><p>현재는 Mock 결과 화면을 사용하고 있어요.</p></section>'; return { cancel() {} }; }
  const profiles = profileApi ?? createProfileApi({ baseUrl: apiBase });
  const questions = questionApi ?? createQuestionApi({ baseUrl: apiBase });
  const controller = new AbortController(); let profile;
  (async () => {
    try {
      profile = await profiles.get();
      if (!profile) throw new Error('저장된 조건이 없습니다. 먼저 프로필을 저장해 주세요.');
      const queue = await questions.list(profile, { sessionId: profiles.sessionId, signal: controller.signal });
      if (controller.signal.aborted) return;
      container.innerHTML = `<div class="hero"><span class="eyebrow">추가 질문</span><h1>판정에 필요한 정보</h1><p class="muted">같은 질문은 한 번만 답하면 관련 정책에 함께 반영됩니다.</p></div>${renderQueue(queue)}`;
      const form = container.querySelector('#question-form');
      if (!form) return;
      form.addEventListener('submit', async event => {
        event.preventDefault(); const status = form.querySelector('#question-status');
        if (form.dataset.busy) return; form.dataset.busy = 'true'; status.textContent = '답변을 저장하고 다시 판정하는 중이에요.';
        for (const control of form.querySelectorAll('input, select, button')) control.disabled = true;
        try {
          const answers = normalizeAnswers(queue.questions, Object.fromEntries(new FormData(form)));
          const next = { ...profile, answers: { ...(profile.answers ?? {}), ...answers } };
          await profiles.put(next);
          await onRejudge(next, profiles.sessionId, controller.signal);
        } catch (error) {
          form.dataset.busy = '';
          for (const control of form.querySelectorAll('input, select, button')) control.disabled = false;
          status.textContent = error.message || '답변을 저장하지 못했어요. 다시 시도해 주세요.';
        }
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        container.innerHTML = `<section class="card" role="alert"><h1>질문을 불러오지 못했어요.</h1><p>${escape(error.message)}</p><button data-question-retry>다시 시도</button></section>`;
        container.querySelector('[data-question-retry]')?.addEventListener('click', () => {
          mountQuestions(container, { onRejudge, profileApi, questionApi });
        });
      }
    }
  })();
  return { cancel: () => controller.abort() };
}
