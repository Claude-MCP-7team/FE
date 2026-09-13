export const statuses = {
  PASS: { label: '신청 가능', symbol: '✓' },
  FAIL: { label: '조건 미충족', symbol: '×' },
  UNKNOWN: { label: '추가 확인', symbol: '?' },
  FUTURE_PASS: { label: '향후 가능', symbol: '↗' },
};
export function validateFixture(data) {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const status = value => typeof value === 'string' && Object.hasOwn(statuses, value);
  if (data?.schema_version !== '0.1-draft' || !object(data.profile) ||
      !['results', 'policies', 'questions', 'documents', 'schedules'].every(key => Array.isArray(data[key]) && data[key].every(object)) ||
      !object(data.combination) || !Array.isArray(data.combination.policy_ids) ||
      !Array.isArray(data.combination.conflicts) || !data.combination.conflicts.every(object) || !status(data.combination.compatibility)) throw new Error('지원하지 않는 Mock 계약입니다.');
  if (data.policies.some(p => typeof p.policy_id !== 'string' || !p.policy_id.trim())) throw new Error('정책 ID가 필요합니다.');
  const ids = new Set(data.policies.map(p => p.policy_id));
  if (ids.size !== data.policies.length) throw new Error('정책 ID가 중복되었습니다.');
  for (const item of [...data.questions, ...data.documents, ...data.schedules]) {
    if (!ids.has(item.policy_id)) throw new Error('존재하지 않는 정책 참조입니다.');
  }
  if (!data.combination.policy_ids.every(id => ids.has(id))) throw new Error('조합의 정책 참조가 올바르지 않습니다.');
  for (const conflict of data.combination.conflicts) {
    if (!Array.isArray(conflict.policy_ids) || !conflict.policy_ids.every(id => ids.has(id))) throw new Error('충돌의 정책 참조가 올바르지 않습니다.');
  }
  for (const result of data.results) {
    if (!ids.has(result.policy_id) || !status(result.status) || !Array.isArray(result.conditions) || !result.reason) throw new Error('판정 데이터가 올바르지 않습니다.');
    if (result.status === 'FUTURE_PASS' && !isCalendarDate(result.future_eligibility_date)) throw new Error('유효한 향후 가능 날짜가 필요합니다.');
    for (const condition of result.conditions) if (!object(condition) || !status(condition.status) || !condition.evidence?.quote) throw new Error('조건별 상태와 근거가 필요합니다.');
  }
  return data;
}
function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}
export function parseRoute(hash) {
  const [page = 'results', id] = hash.replace(/^#\/?/, '').split('/');
  return { page: page || 'results', id };
}
