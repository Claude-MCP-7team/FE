import { ApiError } from './profile-api.js';
import { validatePlanResponse } from './plan-contract.js';

function timeoutSignal(signal, timeoutMs) {
  const controller = new AbortController(); let timer;
  const cancel = () => controller.abort();
  if (signal) { if (signal.aborted) controller.abort(); else signal.addEventListener('abort', cancel, { once: true }); }
  timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); } };
}

export function createPlanApi({ baseUrl = '', fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  return {
    async list(profile, { sessionId = null, policyIds = [], signal } = {}) {
      if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new ApiError('조건 입력 형식이 올바르지 않아요.', { code: 'INVALID_PROFILE' });
      const request = timeoutSignal(signal, timeoutMs); let response;
      try {
        const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' });
        if (sessionId) headers.set('X-Session-Id', sessionId);
        if (policyIds.length) headers.set('X-Policy-Ids', policyIds.join(','));
        try { response = await fetchImpl(`${String(baseUrl).replace(/\/$/, '')}/v1/plan`, { method: 'POST', headers, body: JSON.stringify(profile), signal: request.signal, cache: 'no-store' }); }
        catch (error) { throw new ApiError('신청 계획을 불러오지 못했어요.', { code: request.signal.aborted ? (signal?.aborted ? 'REQUEST_CANCELLED' : 'REQUEST_TIMEOUT') : 'NETWORK_ERROR', cause: error }); }
        let body; try { body = await response.json(); } catch (error) { throw new ApiError('신청 계획 응답을 읽지 못했어요.', { code: 'INVALID_RESPONSE', cause: error }); }
        if (!response.ok) throw new ApiError(body?.detail || '신청 계획 요청에 실패했어요.', { code: 'HTTP_ERROR', status: response.status, response: body });
        return validatePlanResponse(body);
      } finally { request.clear(); }
    },
  };
}
