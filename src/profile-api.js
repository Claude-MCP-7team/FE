const sessionKey = 'ypc.session-id.v1';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', detail = null } = {}) {
    super(message); this.name = 'ApiError'; this.status = status; this.code = code; this.detail = detail;
  }
}

export function createProfileApi({ baseUrl = globalThis.__YPC_API_BASE__ ?? '', fetchImpl = globalThis.fetch, storage = globalThis.sessionStorage } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch 구현이 필요합니다.');
  const url = path => `${String(baseUrl).replace(/\/$/, '')}${path}`;
  const readSession = () => storage.getItem(sessionKey);
  const writeSession = id => storage.setItem(sessionKey, id);
  const clearSession = () => storage.removeItem(sessionKey);
  async function request(path, options = {}) {
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    const session = readSession();
    if (session) headers.set('X-Session-Id', session);
    let response;
    try { response = await fetchImpl(url(path), { ...options, headers }); }
    catch (error) { throw new ApiError('서버에 연결하지 못했어요.', { detail: error }); }
    let body = null;
    const text = await response.text();
    if (text) { try { body = JSON.parse(text); } catch { body = null; } }
    if (!response.ok) {
      const detail = body?.detail ?? body?.error?.message ?? null;
      throw new ApiError(detail || `요청을 처리하지 못했어요. (${response.status})`, { status: response.status, code: body?.error?.code ?? 'HTTP_ERROR', detail });
    }
    return body;
  }
  return {
    get sessionId() { return readSession(); },
    async create(profile = null) {
      const body = profile == null ? undefined : JSON.stringify(profile);
      const result = await request('/v1/sessions', { method: 'POST', ...(body === undefined ? {} : { body }) });
      if (!result || typeof result.session_id !== 'string' || !uuid.test(result.session_id)) throw new ApiError('서버가 올바른 세션 ID를 반환하지 않았어요.', { code: 'INVALID_RESPONSE' });
      writeSession(result.session_id);
      return result.session_id;
    },
    async get() {
      const id = readSession();
      if (!id) return null;
      try { const result = await request(`/v1/sessions/${encodeURIComponent(id)}`); return result?.profile ?? null; }
      catch (error) { if (error instanceof ApiError && error.status === 404) clearSession(); throw error; }
    },
    async put(profile) {
      const id = readSession();
      if (!id) throw new ApiError('저장할 세션이 없습니다.', { code: 'NO_SESSION' });
      await request(`/v1/sessions/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(profile) });
      return profile;
    },
    async upsert(profile) { return readSession() ? this.put(profile) : (await this.create(profile), profile); },
    async remove() {
      const id = readSession();
      if (!id) return false;
      try { await request(`/v1/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }); return true; }
      finally { clearSession(); }
    },
  };
}

const regionCodes = { 'gyeonggi-yongin': '41465', 'gyeonggi-other': '41', other: '00' };
const enumMap = {
  education: { enrolled: 'university_enrolled', graduated: 'university_graduated' },
  employment_status: { unemployed: 'job_seeking', employed: 'employed', 'self-employed': 'founder' },
  marital_status: { single: 'single', married: 'married' },
};
const reverseRegionCodes = Object.fromEntries(Object.entries(regionCodes).map(([key, value]) => [value, key]));
const reverseEnumMap = {
  education: { university_enrolled: 'enrolled', university_graduated: 'graduated' },
  employment_status: { job_seeking: 'unemployed', employed: 'employed', founder: 'self-employed' },
  marital_status: { single: 'single', married: 'married' },
};
export function toBackendProfile(draft, { receivedPolicyIds = [], similarProgramParticipation2y = null, incomeBasis = null, householdIncomeRatioMedian = null } = {}) {
  const unsupported = ['personal_income', 'household_income', 'employment_type'].filter(key => draft?.[key] !== null && draft?.[key] !== undefined && draft?.[key] !== '');
  if (draft?.policy_history === 'yes') unsupported.push('policy_history');
  if (unsupported.length) throw new ApiError(`BE 계약에 없는 입력값이 있습니다: ${unsupported.join(', ')}`, { code: 'PROFILE_MAPPING_REQUIRED' });
  const value = key => draft?.[key] || null;
  return {
    core: {
      birth_date: draft.birth_date,
      region_code: regionCodes[draft.region] ?? draft.region ?? '',
      residence_start_date: value('residence_start_date'), residence_continuous: true,
      education: enumMap.education[draft.education] ?? null,
      employment_status: enumMap.employment_status[draft.employment_status] ?? null,
      employment_start_date: null,
      marital_status: enumMap.marital_status[draft.marital_status] ?? null,
      household_size: draft.household_size === '' ? null : draft.household_size,
      income_basis: incomeBasis, household_income_ratio_median: householdIncomeRatioMedian,
    },
    history: { received_policy_ids: receivedPolicyIds, similar_program_participation_2y: similarProgramParticipation2y },
    answers: {}, consent: { terms_version: '1.0', privacy_agreed_at: null, retention_days: 90 },
  };
}

export function fromBackendProfile(profile = {}) {
  const core = profile.core ?? {};
  return {
    birth_date: core.birth_date ?? '',
    region: reverseRegionCodes[core.region_code] ?? core.region_code ?? '',
    residence_start_date: core.residence_start_date ?? '',
    education: reverseEnumMap.education[core.education] ?? '',
    employment_status: reverseEnumMap.employment_status[core.employment_status] ?? '',
    marital_status: reverseEnumMap.marital_status[core.marital_status] ?? '',
    household_size: core.household_size ?? '',
    personal_income: null,
    household_income: null,
    employment_type: null,
    policy_history: (profile.history?.received_policy_ids ?? []).length ? 'yes' : '',
  };
}
