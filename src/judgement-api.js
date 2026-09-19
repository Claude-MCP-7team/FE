import { ApiError } from './profile-api.js';
import { validateJudgementResponse } from './judgement-contract.js';
import { parseProblem } from './problem.js';

export function createJudgementApi({ baseUrl = globalThis.__YPC_API_BASE__ ?? '', fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch 구현이 필요합니다.');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647) throw new TypeError('유효한 요청 제한 시간이 필요합니다.');
  return {
    async judge(profile, { sessionId = null, signal } = {}) {
      if (!profile?.core || typeof profile.core !== 'object' || Array.isArray(profile.core)) {
        throw new ApiError('저장된 서버 프로필이 필요합니다.', { code: 'INVALID_PROFILE' });
      }
      if (signal?.aborted) throw new ApiError('판정 요청을 취소했어요.', { code: 'REQUEST_CANCELLED' });
      // Serialize before allocating timers; no values are logged or persisted here.
      const body = JSON.stringify(profile);
      const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' });
      if (sessionId) headers.set('X-Session-Id', sessionId);
      const controller = new AbortController();
      let rejectAbort;
      const aborted = new Promise((resolve, reject) => { rejectAbort = reject; });
      const cancel = code => {
        rejectAbort(new ApiError(code === 'REQUEST_TIMEOUT' ? '판정 요청 시간이 초과됐어요. 다시 시도해 주세요.' : '판정 요청을 취소했어요.', { code }));
        controller.abort();
      };
      const onCancel = () => cancel('REQUEST_CANCELLED');
      signal?.addEventListener('abort', onCancel, { once: true });
      const timer = setTimeout(() => cancel('REQUEST_TIMEOUT'), timeoutMs);
      const request = async () => {
        let response, responseText;
        try {
          response = await fetchImpl(`${String(baseUrl).replace(/\/$/, '')}/v1/judge?include=all`, { method: 'POST', headers, body, signal: controller.signal, cache: 'no-store' });
          responseText = await response.text();
        } catch (error) {
          throw new ApiError('판정 서버에 연결하지 못했어요.', { cause: error });
        }
        let data;
        try { data = JSON.parse(responseText); }
        catch {
          if (response.ok) throw new ApiError('판정 응답 형식이 올바르지 않아요.', { code: 'INVALID_RESPONSE' });
        }
        if (!response.ok) {
          const problem = parseProblem(data, response.status);
          throw new ApiError(problem.message, { status: response.status, code: problem.code, type: problem.type, detail: problem.detail });
        }
        const result = validateJudgementResponse(data);
        if (result.session_id !== (sessionId || 'anonymous')) throw new ApiError('판정 세션이 요청과 일치하지 않아요.', { code: 'INVALID_RESPONSE', detail: 'session_id' });
        return result;
      };
      try { return await Promise.race([aborted, request()]); }
      finally { clearTimeout(timer); signal?.removeEventListener('abort', onCancel); }
    },
  };
}
