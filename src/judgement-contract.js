import { ApiError } from './profile-api.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const scalar = value => typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
const jsonValue = value => value === null || scalar(value) || (Array.isArray(value) && value.every(scalar));
const count = value => Number.isSafeInteger(value) && value >= 0;
const verdictKeys = { ELIGIBLE: 'eligible', INELIGIBLE: 'ineligible', NEEDS_INFO: 'needs_info' };
const confidences = ['CONFIRMED', 'ESTIMATED', 'NEEDS_REVIEW'];
function requireValue(valid, path) {
  if (!valid) throw new ApiError('판정 응답을 확인할 수 없어요. 다시 시도해 주세요.', { code: 'INVALID_RESPONSE', detail: path });
}
function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
function nullableText(value, path) { requireValue(value === undefined || value === null || typeof value === 'string', path); }
function sourceUrl(value, path) {
  if (value === undefined || value === null) return;
  let valid = false;
  if (text(value)) {
    try { valid = ['http:', 'https:'].includes(new URL(value).protocol); } catch { /* Invalid source URL. */ }
  }
  requireValue(valid, path);
}

// This boundary validates include=all responses, not the legacy 0.1-draft mock.
export function validateJudgementResponse(data) {
  requireValue(object(data), 'response');
  for (const key of ['session_id', 'snapshot_version', 'disclaimer']) requireValue(text(data[key]), key);
  requireValue(object(data.summary), 'summary');
  for (const key of Object.values(verdictKeys)) requireValue(count(data.summary[key]), `summary.${key}`);
  requireValue(data.latency_ms === undefined || count(data.latency_ms), 'latency_ms');
  requireValue(Array.isArray(data.results), 'results');
  const policyIds = new Set();
  const totals = { eligible: 0, ineligible: 0, needs_info: 0 };
  data.results.forEach((result, index) => {
    const path = `results[${index}]`;
    requireValue(object(result), path);
    requireValue(text(result.policy_id) && !policyIds.has(result.policy_id), `${path}.policy_id`);
    policyIds.add(result.policy_id);
    requireValue(typeof result.verdict === 'string' && Object.hasOwn(verdictKeys, result.verdict), `${path}.verdict`);
    totals[verdictKeys[result.verdict]]++;
    requireValue(confidences.includes(result.confidence), `${path}.confidence`);
    for (const key of ['title', 'explanation', 'dept_name', 'dept_tel']) nullableText(result[key], `${path}.${key}`);
    sourceUrl(result.origin_url, `${path}.origin_url`);
    requireValue(result.disclaimer_required === undefined || typeof result.disclaimer_required === 'boolean', `${path}.disclaimer_required`);
    if (result.confidence !== 'CONFIRMED') {
      for (const key of ['dept_name', 'dept_tel', 'origin_url']) requireValue(text(result[key]), `${path}.${key}`);
    }
    const ruleIds = new Set();
    for (const group of ['matched', 'unmatched', 'unknown']) {
      requireValue(Array.isArray(result[group]), `${path}.${group}`);
      result[group].forEach((rule, ruleIndex) => {
        const rulePath = `${path}.${group}[${ruleIndex}]`;
        requireValue(object(rule), rulePath);
        requireValue(text(rule.rule_id) && !ruleIds.has(rule.rule_id), `${rulePath}.rule_id`);
        ruleIds.add(rule.rule_id);
        requireValue(text(rule.field), `${rulePath}.field`);
        requireValue(text(rule.source_quote), `${rulePath}.source_quote`);
        sourceUrl(rule.source_url, `${rulePath}.source_url`);
        if (group !== 'unknown') requireValue(Object.hasOwn(rule, 'user_value') && jsonValue(rule.user_value), `${rulePath}.user_value`);
        if (group === 'unknown') nullableText(rule.question_template, `${rulePath}.question_template`);
        if (group === 'unmatched') {
          requireValue(Object.hasOwn(rule, 'required') && jsonValue(rule.required), `${rulePath}.required`);
          nullableText(rule.unit, `${rulePath}.unit`);
          for (const key of ['time_satisfiable', 'permanently_unsatisfiable']) requireValue(rule[key] === undefined || typeof rule[key] === 'boolean', `${rulePath}.${key}`);
          requireValue(rule.satisfiable_from === undefined || rule.satisfiable_from === null || calendarDate(rule.satisfiable_from), `${rulePath}.satisfiable_from`);
          requireValue(!(rule.satisfiable_from != null && rule.permanently_unsatisfiable === true), `${rulePath}.satisfiable_from`);
        }
      });
    }
  });
  for (const key of Object.values(verdictKeys)) requireValue(totals[key] === data.summary[key], `summary.${key}`);
  return data;
}

// Array membership and the BE-supplied date determine only the condition display.
// Policy verdict/confidence remain unchanged; no aggregate future date is invented.
export function toJudgementView(data) {
  const view = structuredClone(validateJudgementResponse(data));
  view.results = view.results.map(result => ({
    ...result,
    conditions: ['matched', 'unmatched', 'unknown'].flatMap(group => result[group].map(rule => ({
      ...rule,
      status: group === 'matched' ? 'PASS' : group === 'unknown' ? 'UNKNOWN' : rule.satisfiable_from != null ? 'FUTURE_PASS' : 'FAIL',
      evidence: { quote: rule.source_quote, url: rule.source_url ?? result.origin_url ?? null },
    }))),
  }));
  return view;
}
