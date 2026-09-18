// FE editing draft only. Required fields, enums and income period await Issue #2.
export const choices = {
  region: [['gyeonggi-yongin', '경기도 용인시'], ['gyeonggi-other', '경기도 내 다른 지역'], ['other', '그 외 지역']],
  education: [['enrolled', '재학'], ['on-leave', '휴학'], ['graduated', '졸업'], ['other', '기타']],
  employment_status: [['unemployed', '미취업'], ['employed', '재직 중'], ['self-employed', '자영업'], ['other', '기타']],
  employment_type: [['regular', '정규직'], ['contract', '계약직'], ['part-time', '아르바이트'], ['freelance', '프리랜서'], ['not-applicable', '해당 없음']],
  marital_status: [['single', '미혼'], ['married', '기혼'], ['other', '기타']],
  policy_history: [['none', '없음'], ['yes', '있음']],
};
// Confirmed BE enums; legacy draft IDs retain their explicit API mappings.
export const serverChoices = {
  ...choices,
  education: [['middle_or_below', '중학교 졸업 이하'], ['high_school_enrolled', '고등학교 재학'], ['high_school_graduated', '고등학교 졸업'], ['enrolled', '대학교 재학'], ['graduated', '대학교 졸업'], ['graduate_school', '대학원']],
  employment_status: [['employed', '재직 중'], ['unemployed', '구직 중'], ['student', '학생'], ['self-employed', '창업·자영업'], ['neet', '미취업·비구직']],
  marital_status: [['single', '미혼'], ['married', '기혼'], ['divorced', '이혼'], ['widowed', '사별']],
};
export const fields = ['birth_date', 'region', 'residence_start_date', 'education', 'employment_status', 'employment_type', 'personal_income', 'household_income', 'household_size', 'marital_status', 'policy_history'];
export const emptyProfile = () => Object.fromEntries(fields.map(key => [key, '']));
export function todayLocal(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return year > 0 && month > 0 && month <= 12 && day > 0 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
export function validateProfile(input, today = todayLocal(), { choiceSets = choices, requireResidence = true } = {}) {
  const value = emptyProfile();
  for (const key of fields) value[key] = String(input?.[key] ?? '').trim();
  const errors = {};
  for (const key of ['birth_date', 'residence_start_date']) {
    if (key === 'residence_start_date' && !requireResidence && !value[key]) continue;
    if (!value[key]) errors[key] = '날짜를 입력해 주세요.';
    else if (!validDate(value[key])) errors[key] = '실제로 존재하는 날짜를 입력해 주세요.';
    else if (value[key] > today) errors[key] = '오늘 이후 날짜는 입력할 수 없어요.';
  }
  if (!errors.birth_date && !errors.residence_start_date && value.residence_start_date && value.residence_start_date < value.birth_date) errors.residence_start_date = '거주 시작일은 생년월일 이후여야 해요.';
  if (!value.region) errors.region = '거주지역을 선택해 주세요.';
  for (const [key, options] of Object.entries(choiceSets)) {
    if (value[key] && !options.some(([id]) => id === value[key])) errors[key] = '목록에서 다시 선택해 주세요.';
  }
  for (const key of ['personal_income', 'household_income', 'household_size']) {
    if (value[key] === '') { value[key] = null; continue; }
    if (!/^\d+$/.test(value[key]) || !Number.isSafeInteger(Number(value[key])) || (key === 'household_size' && Number(value[key]) < 1)) {
      errors[key] = key === 'household_size' ? '가구원 수는 1 이상의 정수로 입력해 주세요.' : '소득은 0 이상의 정수로 입력해 주세요.';
    } else value[key] = Number(value[key]);
  }
  for (const key of Object.keys(choices)) if (!value[key]) value[key] = null;
  return { value, errors };
}
const storageKey = 'ypc.profile-form.v1';
export function readDraft(storage) {
  const raw = storage.getItem(storageKey);
  if (raw === null) return null;
  const parsed = JSON.parse(raw);
  if (parsed?.version !== 1 || !parsed.profile || typeof parsed.profile !== 'object' || Array.isArray(parsed.profile)) throw new Error('저장된 조건 형식이 올바르지 않습니다.');
  const { value, errors } = validateProfile(parsed.profile);
  if (Object.keys(errors).length) throw new Error('저장된 조건을 확인할 수 없습니다.');
  return value;
}
export function saveDraft(storage, profile) {
  const { value, errors } = validateProfile(profile);
  if (Object.keys(errors).length) throw new Error('입력값을 확인해 주세요.');
  storage.setItem(storageKey, JSON.stringify({ version: 1, profile: value }));
  return value;
}
export function removeDraft(storage) { storage.removeItem(storageKey); }
