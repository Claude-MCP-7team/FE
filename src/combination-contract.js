import { ApiError } from './profile-api.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const count = value => Number.isSafeInteger(value) && value >= 0;
const nullableText = value => value === null || value === undefined || typeof value === 'string';
const sourceUrl = value => value === null || value === undefined || (text(value) && (() => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } })());
function requireValue(valid, detail) { if (!valid) throw new ApiError('조합 추천 응답을 확인할 수 없어요. 다시 시도해 주세요.', { code: 'INVALID_RESPONSE', detail }); }

function validateMember(member, path) {
  requireValue(object(member) && text(member.policy_id) && text(member.title) && count(member.estimated_total_krw), path);
  requireValue(member.amount_estimated === undefined || typeof member.amount_estimated === 'boolean', `${path}.amount_estimated`);
}

function validateExcluded(item, path) {
  requireValue(object(item) && text(item.policy_id) && text(item.title) && count(item.estimated_total_krw), path);
  for (const key of ['conflicts_with', 'conflicts_with_title', 'conflict_type', 'source_quote']) requireValue(text(item[key]), `${path}.${key}`);
  requireValue(['CONFIRMED', 'ESTIMATED'].includes(item.confidence), `${path}.confidence`);
  requireValue(sourceUrl(item.source_url), `${path}.source_url`);
  for (const key of ['dept_name', 'dept_tel']) requireValue(nullableText(item[key]), `${path}.${key}`);
}

export function validateCombinationResponse(data) {
  requireValue(object(data), 'response');
  requireValue(text(data.snapshot_version), 'snapshot_version');
  requireValue(count(data.eligible_count), 'eligible_count');
  requireValue(Array.isArray(data.scenarios), 'scenarios');
  requireValue(text(data.disclaimer), 'disclaimer');
  data.scenarios.forEach((scenario, index) => {
    const path = `scenarios[${index}]`;
    requireValue(object(scenario) && ['conservative', 'maximal'].includes(scenario.kind), `${path}.kind`);
    requireValue(text(scenario.label) && text(scenario.description), path);
    requireValue(scenario.approximate === undefined || typeof scenario.approximate === 'boolean', `${path}.approximate`);
    requireValue(Array.isArray(scenario.combinations), `${path}.combinations`);
    scenario.combinations.forEach((combination, combinationIndex) => {
      const combinationPath = `${path}.combinations[${combinationIndex}]`;
      requireValue(object(combination) && count(combination.rank) && combination.rank > 0 && count(combination.total_krw), combinationPath);
      requireValue(Array.isArray(combination.members) && combination.members.length > 0, `${combinationPath}.members`);
      combination.members.forEach((member, memberIndex) => validateMember(member, `${combinationPath}.members[${memberIndex}]`));
      requireValue(combination.total_krw === combination.members.reduce((total, member) => total + member.estimated_total_krw, 0), `${combinationPath}.total_krw`);
      requireValue(Array.isArray(combination.excluded), `${combinationPath}.excluded`);
      combination.excluded.forEach((item, itemIndex) => validateExcluded(item, `${combinationPath}.excluded[${itemIndex}]`));
      requireValue(combination.total_is_estimated === undefined || typeof combination.total_is_estimated === 'boolean', `${combinationPath}.total_is_estimated`);
    });
  });
  return data;
}
