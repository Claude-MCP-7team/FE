import { ApiError } from './profile-api.js';
import { parseProblem } from './problem.js';

function timeoutSignal(signal, timeoutMs) {
  const controller = new AbortController(); let timer;
  const cancel = () => controller.abort();
  if (signal) { if (signal.aborted) controller.abort(); else signal.addEventListener('abort', cancel, { once: true }); }
  timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); } };
}

// judge results carry only policy_id -- title, deadline and amount live in the
// catalog (see FE issue #29 / BE issue #8). This is display enrichment, not a
// judgement input, so a malformed item is skipped rather than failing the whole
// list: one bad catalog row should not blank every policy card's metadata.
function readItem(item) {
  if (!item || typeof item !== 'object' || typeof item.policy_id !== 'string' || !item.policy_id) return null;
  const text = value => (typeof value === 'string' && value.trim() ? value : null);
  const amount = value => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null);
  return {
    policy_id: item.policy_id,
    title: text(item.title),
    apply_start: text(item.apply_start),
    apply_end: text(item.apply_end),
    is_rolling: item.is_rolling === true,
    amount_krw: amount(item.amount_krw),
    estimated_total_krw: amount(item.estimated_total_krw),
    amount_confidence: text(item.amount_confidence),
  };
}

export function createPoliciesApi({ baseUrl = '', fetchImpl = fetch, timeoutMs = 15000, pageSize = 100 } = {}) {
  return {
    async list({ signal } = {}) {
      const items = [];
      let offset = 0;
      let total = Infinity;
      while (items.length < total) {
        const request = timeoutSignal(signal, timeoutMs);
        try {
          let response;
          try { response = await fetchImpl(`${String(baseUrl).replace(/\/$/, '')}/v1/policies?limit=${pageSize}&offset=${offset}`, { signal: request.signal, cache: 'no-store' }); }
          catch (error) { throw new ApiError('정책 목록을 불러오지 못했어요.', { code: request.signal.aborted ? (signal?.aborted ? 'REQUEST_CANCELLED' : 'REQUEST_TIMEOUT') : 'NETWORK_ERROR', cause: error }); }
          let body; try { body = await response.json(); } catch (error) { throw new ApiError('정책 목록 응답을 읽지 못했어요.', { code: 'INVALID_RESPONSE', cause: error }); }
          if (!response.ok) { const problem = parseProblem(body, response.status); throw new ApiError(problem.message, { code: problem.code, type: problem.type, status: response.status, detail: problem.detail }); }
          if (!body || !Array.isArray(body.items)) throw new ApiError('정책 목록 응답 형식이 올바르지 않아요.', { code: 'INVALID_RESPONSE' });
          total = Number.isSafeInteger(body.total) ? body.total : items.length + body.items.length;
          for (const item of body.items) { const parsed = readItem(item); if (parsed) items.push(parsed); }
          if (!body.items.length) break;
          offset += body.items.length;
        } finally { request.clear(); }
      }
      return items;
    },
  };
}
