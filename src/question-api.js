import { ApiError } from './profile-api.js';
import { validateQuestionQueue } from './question-contract.js';

export function createQuestionApi({ baseUrl = globalThis.__YPC_API_BASE__ ?? '', fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch 구현이 필요합니다.');
  return {
    async list(profile, { sessionId = null, signal } = {}) {
      if (!profile?.core || typeof profile.core !== 'object' || Array.isArray(profile.core)) throw new ApiError('저장된 서버 프로필이 필요합니다.', { code: 'INVALID_PROFILE' });
      const controller = new AbortController(); let rejectAbort;
      const aborted = new Promise((resolve, reject) => { rejectAbort = reject; });
      const cancel = code => { rejectAbort(new ApiError(code === 'REQUEST_TIMEOUT' ? '질문 요청 시간이 초과됐어요. 다시 시도해 주세요.' : '질문 요청을 취소했어요.', { code })); controller.abort(); };
      const onCancel = () => cancel('REQUEST_CANCELLED'); signal?.addEventListener('abort', onCancel, { once: true });
      const timer = setTimeout(() => cancel('REQUEST_TIMEOUT'), timeoutMs);
      const request = async () => {
        const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' });
        if (sessionId) headers.set('X-Session-Id', sessionId);
        let response;
        try { response = await fetchImpl(`${String(baseUrl).replace(/\/$/, '')}/v1/questions`, { method: 'POST', headers, body: JSON.stringify(profile), signal: controller.signal, cache: 'no-store' }); }
        catch (error) { throw new ApiError('질문 서버에 연결하지 못했어요.', { detail: error }); }
        let bodyText; try { bodyText = await response.text(); } catch (error) { throw new ApiError('질문 응답을 읽지 못했어요.', { detail: error }); }
        let body = null; try { body = bodyText ? JSON.parse(bodyText) : null; } catch { if (response.ok) throw new ApiError('질문 응답 형식이 올바르지 않아요.', { code: 'INVALID_RESPONSE' }); }
        if (!response.ok) { const detail = body?.detail ?? body?.error?.message; throw new ApiError(typeof detail === 'string' ? detail : `질문 요청을 처리하지 못했어요. (${response.status})`, { status: response.status, code: 'HTTP_ERROR', detail }); }
        return validateQuestionQueue(body);
      };
      try { return await Promise.race([aborted, request()]); } finally { clearTimeout(timer); signal?.removeEventListener('abort', onCancel); }
    },
  };
}
