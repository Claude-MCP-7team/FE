import { serverRegions } from './profile.js';
import { parseProblem } from './problem.js';

const sessionKey = 'ypc.session-id.v1';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', type = null, detail = null, cause = null } = {}) {
    super(message, { cause }); this.name = 'ApiError'; this.status = status; this.code = code; this.type = type; this.detail = detail;
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
    let text;
    try { text = await response.text(); }
    catch (error) { throw new ApiError('서버 응답을 읽지 못했어요. 다시 시도해 주세요.', { detail: error }); }
    if (text) {
      try { body = JSON.parse(text); }
      catch {
        if (response.ok) throw new ApiError('서버 응답 형식이 올바르지 않아요.', { code: 'INVALID_RESPONSE' });
      }
    }
    if (!response.ok) {
      const problem = parseProblem(body, response.status);
      throw new ApiError(problem.message, { status: response.status, code: problem.code, type: problem.type, detail: problem.detail });
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
      try {
        const result = await request(`/v1/sessions/${encodeURIComponent(id)}`);
        if (!result || !Object.hasOwn(result, 'profile') || (result.profile !== null && (typeof result.profile !== 'object' || Array.isArray(result.profile)))) {
          throw new ApiError('서버가 올바른 프로필을 반환하지 않았어요.', { code: 'INVALID_RESPONSE' });
        }
        return result.profile;
      }
      catch (error) { if (error instanceof ApiError && error.status === 404) clearSession(); throw error; }
    },
    async put(profile) {
      const id = readSession();
      if (!id) throw new ApiError('저장할 세션이 없습니다.', { code: 'NO_SESSION' });
      try { await request(`/v1/sessions/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(profile) }); }
      catch (error) { if (error instanceof ApiError && error.status === 404) clearSession(); throw error; }
      return profile;
    },
    async upsert(profile) { return readSession() ? this.put(profile) : (await this.create(profile), profile); },
    async remove() {
      const id = readSession();
      if (!id) return false;
      try { await request(`/v1/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
      catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
      }
      clearSession();
      return true;
    },
  };
}

// Non-region option IDs must match serverChoices in profile.js.
const enumMap = {
  education: { enrolled: 'university_enrolled', graduated: 'university_graduated', middle_or_below: 'middle_or_below', high_school_enrolled: 'high_school_enrolled', high_school_graduated: 'high_school_graduated', graduate_school: 'graduate_school' },
  employment_status: { unemployed: 'job_seeking', employed: 'employed', 'self-employed': 'founder', student: 'student', neet: 'neet' },
  marital_status: { single: 'single', married: 'married', divorced: 'divorced', widowed: 'widowed' },
};
const reverseEnumMap = {
  education: { university_enrolled: 'enrolled', university_graduated: 'graduated' },
  employment_status: { job_seeking: 'unemployed', employed: 'employed', founder: 'self-employed' },
  marital_status: { single: 'single', married: 'married' },
};
export function toBackendProfile(draft, { receivedPolicyIds = [], similarProgramParticipation2y = null, incomeBasis = null, householdIncomeRatioMedian = null, residenceContinuous = undefined, consent = undefined } = {}) {
  const unsupported = ['personal_income', 'household_income', 'employment_type'].filter(key => draft?.[key] !== null && draft?.[key] !== undefined && draft?.[key] !== '');
  if (draft?.policy_history === 'yes') unsupported.push('policy_history');
  if (unsupported.length) throw new ApiError(`BE 계약에 없는 입력값이 있습니다: ${unsupported.join(', ')}`, { code: 'PROFILE_MAPPING_REQUIRED' });
  const value = key => draft?.[key] || null;
  const mapRequired = (field, raw) => {
    if (raw === null || raw === undefined || raw === '') return null;
    const mapped = enumMap[field][raw];
    if (!mapped) throw new ApiError(`Unsupported ${field} value: ${raw}`, { code: 'PROFILE_MAPPING_REQUIRED' });
    return mapped;
  };
  const region = draft?.region;
  if (region && !Object.hasOwn(serverRegions, region)) throw new ApiError('정확한 거주지역을 목록에서 선택해 주세요.', { code: 'PROFILE_MAPPING_REQUIRED' });
  const core = {
    birth_date: draft.birth_date,
    region_code: region || '',
    residence_start_date: value('residence_start_date'),
    education: mapRequired('education', draft.education),
    employment_status: mapRequired('employment_status', draft.employment_status),
    employment_start_date: null,
    marital_status: mapRequired('marital_status', draft.marital_status),
    household_size: draft.household_size === '' ? null : draft.household_size,
    income_basis: incomeBasis, household_income_ratio_median: householdIncomeRatioMedian,
  };
  if (typeof residenceContinuous === 'boolean') core.residence_continuous = residenceContinuous;
  return {
    core,
    history: { received_policy_ids: receivedPolicyIds, similar_program_participation_2y: similarProgramParticipation2y },
    answers: {}, consent: consent ?? { privacy_agreed_at: null },
  };
}

export function fromBackendProfile(profile = {}) {
  const core = profile.core ?? {};
  return {
    birth_date: core.birth_date ?? '',
    region: core.region_code ?? '',
    residence_start_date: core.residence_start_date ?? '',
    education: reverseEnumMap.education[core.education] ?? core.education ?? '',
    employment_status: reverseEnumMap.employment_status[core.employment_status] ?? core.employment_status ?? '',
    marital_status: reverseEnumMap.marital_status[core.marital_status] ?? core.marital_status ?? '',
    household_size: core.household_size ?? '',
    personal_income: null,
    household_income: null,
    employment_type: null,
    policy_history: (profile.history?.received_policy_ids ?? []).length ? 'yes' : '',
  };
}
