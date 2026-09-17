import { ApiError, fromBackendProfile, toBackendProfile } from './profile-api.js';
import { choices, emptyProfile, validateProfile } from './profile.js';

const editableCore = { birth_date: 'birth_date', region: 'region_code', residence_start_date: 'residence_start_date', education: 'education', employment_status: 'employment_status', marital_status: 'marital_status', household_size: 'household_size' };
const same = (a, b) => (a ?? '') === (b ?? '');

// PUT replaces the entire document. Only explicitly changed form fields may replace it.
export function mergeProfileDraft(draft, original) {
  if (!original) return toBackendProfile(draft);
  const before = fromBackendProfile(original);
  const result = structuredClone(original);
  for (const key of Object.keys(draft)) {
    if (same(draft[key], before[key])) continue;
    const mapped = toBackendProfile({ ...emptyProfile(), [key]: draft[key] });
    if (editableCore[key]) result.core[editableCore[key]] = mapped.core[editableCore[key]];
    else if (key === 'policy_history') {
      // A yes/no control cannot accurately edit a list of received policies.
      throw new ApiError('기존 정책 참여 이력은 정책 목록 연결 후 수정할 수 있어요.', { code: 'PROFILE_MAPPING_REQUIRED' });
    }
  }
  return result;
}

export function createProfileRepository(api) {
  let original = null;
  let loaded = false;
  let busy = false;
  const exclusive = async action => {
    if (busy) throw new ApiError('이전 요청이 끝난 뒤 다시 시도해 주세요.', { code: 'REQUEST_PENDING' });
    busy = true;
    try { return await action(); } finally { busy = false; }
  };
  return {
    validate,
    load: () => exclusive(async () => {
      loaded = false;
      try { original = await api.get(); }
      catch (error) {
        if (error.status !== 404) throw error;
        original = null;
      }
      if (original && (!original.core || typeof original.core !== 'object' || Array.isArray(original.core))) {
        throw new ApiError('저장된 기본 정보를 확인할 수 없어요.', { code: 'INVALID_RESPONSE' });
      }
      loaded = true;
      return original ? fromBackendProfile(original) : null;
    }),
    save: draft => exclusive(async () => {
      if (!loaded) throw new ApiError('기존 조건을 먼저 불러와 주세요.', { code: 'PROFILE_NOT_LOADED' });
      const { value, errors } = validate(draft);
      if (Object.keys(errors).length) throw new ApiError('입력 내용을 확인해 주세요.', { code: 'INVALID_PROFILE', detail: errors });
      const next = mergeProfileDraft(value, original);
      await api.upsert(next);
      original = next;
      return fromBackendProfile(next);
    }),
    remove: () => exclusive(async () => {
      await api.remove();
      original = null;
      loaded = true;
    }),
  };

  function validate(input) {
    const checked = validateProfile(input);
    const before = original ? fromBackendProfile(original) : null;
    if (before) for (const key of Object.keys(choices)) {
      if (checked.value[key] && same(checked.value[key], before[key])) delete checked.errors[key];
    }
    return checked;
  }
}
