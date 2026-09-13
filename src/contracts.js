export const statuses = {
  PASS: { label: '신청 가능', symbol: '✓' },
  FAIL: { label: '조건 미충족', symbol: '×' },
  UNKNOWN: { label: '추가 확인', symbol: '?' },
  FUTURE_PASS: { label: '향후 가능', symbol: '↗' },
};
export function validateFixture(data) {
  if (data?.schema_version !== '0.1-draft' || !Array.isArray(data.results) || !Array.isArray(data.policies)) throw new Error('지원하지 않는 Mock 계약입니다.');
  const ids = new Set(data.policies.map(p => p.policy_id));
  if (ids.size !== data.policies.length) throw new Error('정책 ID가 중복되었습니다.');
  for (const result of data.results) {
    if (!ids.has(result.policy_id) || !statuses[result.status] || !Array.isArray(result.conditions) || !result.reason) throw new Error('판정 데이터가 올바르지 않습니다.');
    if (result.status === 'FUTURE_PASS' && !/^\d{4}-\d{2}-\d{2}$/.test(result.future_eligibility_date ?? '')) throw new Error('향후 가능 날짜가 필요합니다.');
    for (const condition of result.conditions) if (!statuses[condition.status] || !condition.evidence?.quote) throw new Error('조건별 상태와 근거가 필요합니다.');
  }
  return data;
}
export function parseRoute(hash) {
  const [page = 'results', id] = hash.replace(/^#\/?/, '').split('/');
  return { page: page || 'results', id };
}
