import { ApiError, fromBackendProfile, toBackendProfile } from './profile-api.js';
import { serverChoices, emptyProfile, validateProfile } from './profile.js';

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
  let pending = null;
  const exclusive = async (kind, action) => {
    if (pending) throw new ApiError('이전 요청이 끝난 뒤 다시 시도해 주세요.', { code: 'REQUEST_PENDING' });
    const operation = { kind, promise: null };
    pending = operation;
    operation.promise = (async () => {
      try { return await action(); } finally { pending = null; }
    })();
    return operation.promise;
  };
  return {
    validate,
    async loadForForm() {
      if (pending?.kind === 'load') return pending.promise;
      if (pending) {
        // The originating form handles mutation errors. Re-entry still needs a fresh read.
        try { await pending.promise; } catch { /* Read the actual server state below. */ }
        return this.loadForForm();
      }
      return this.load();
    },
    load: () => exclusive('load', async () => {
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
    save: draft => exclusive('save', async () => {
      if (!loaded) throw new ApiError('기존 조건을 먼저 불러와 주세요.', { code: 'PROFILE_NOT_LOADED' });
      const { value, errors } = validate(draft);
      if (Object.keys(errors).length) throw new ApiError('입력 내용을 확인해 주세요.', { code: 'INVALID_PROFILE', detail: errors });
      const next = mergeProfileDraft(value, original);
      await api.upsert(next);
      original = next;
      return fromBackendProfile(next);
    }),
    remove: () => exclusive('remove', async () => {
      await api.remove();
      original = null;
      loaded = true;
    }),
  };

  function validate(input) {
    const checked = validateProfile(input, undefined, { choiceSets: serverChoices, requireResidence: false });
    const before = original ? fromBackendProfile(original) : null;
    if (before) for (const key of Object.keys(serverChoices)) {
      if (checked.value[key] && same(checked.value[key], before[key])) delete checked.errors[key];
    }
    if (checked.errors.region && checked.value.region) checked.errors.region = '실제 거주하는 구를 목록에서 선택해 주세요. 다른 지역으로 대신 저장할 수는 없어요.';
    for (const key of ['personal_income', 'household_income', 'employment_type']) {
      if (checked.value[key] !== null && checked.value[key] !== '') checked.errors[key] = '현재 서버에 저장할 수 없는 항목이에요. 비워두세요.';
    }
    if (before ? !same(checked.value.policy_history, before.policy_history) : checked.value.policy_history === 'yes') {
      checked.errors.policy_history = '참여 정책 목록이 준비되면 수정할 수 있어요. 기존 값을 유지해 주세요.';
    }
    return checked;
  }
}
