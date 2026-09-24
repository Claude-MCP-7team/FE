import { ApiError } from './profile-api.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const count = value => Number.isSafeInteger(value) && value >= 0;
const integer = value => Number.isSafeInteger(value);
const nullableText = value => value === null || value === undefined || typeof value === 'string';
const sourceUrl = value => value === null || value === undefined || (text(value) && (() => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } })());
const date = value => value === null || value === undefined || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && (() => { const [year, month, day] = value.split('-').map(Number); const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0); return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]; })());
function requireValue(valid, detail) { if (!valid) throw new ApiError('신청 계획 응답을 확인할 수 없어요. 다시 시도해 주세요.', { code: 'INVALID_RESPONSE', detail }); }

function validateDocument(document, path) {
  requireValue(object(document) && text(document.name), path);
  for (const key of ['doc_code', 'issuer', 'notes', 'source_quote', 'issue_kind', 'channel']) requireValue(nullableText(document[key]), `${path}.${key}`);
  for (const key of ['lead_time_business_days', 'cost_krw']) requireValue(document[key] === undefined || document[key] === null || count(document[key]), `${path}.${key}`);
  for (const key of ['lead_time_min_business_days', 'validity_days']) requireValue(document[key] === undefined || document[key] === null || count(document[key]), `${path}.${key}`);
  for (const key of ['lead_time_estimated', 'requires_visit', 'master_unverified']) requireValue(document[key] === undefined || typeof document[key] === 'boolean', `${path}.${key}`);
  for (const key of ['issue_not_before']) requireValue(date(document[key]), `${path}.${key}`);
}

export function validatePlanResponse(data) {
  requireValue(object(data) && text(data.snapshot_version) && date(data.generated_for_date), 'response');
  requireValue(object(data.summary), 'summary');
  for (const key of ['total', 'urgent', 'on_track', 'rolling', 'unknown_deadline', 'closed', 'infeasible']) requireValue(count(data.summary[key]), `summary.${key}`);
  requireValue(Array.isArray(data.plans) && Array.isArray(data.documents), 'plans');
  requireValue(count(data.total_document_cost_krw) && count(data.visit_required_count) && count(data.unverified_document_count) && count(data.cost_unknown_document_count), 'document_summary');
  requireValue(typeof data.calendar_source_ref === 'string' && typeof data.disclaimer === 'string', 'metadata');
  const policyIds = new Set();
  data.plans.forEach((plan, index) => {
    const path = `plans[${index}]`;
    requireValue(object(plan) && text(plan.policy_id) && text(plan.title), path);
    requireValue(['URGENT', 'ON_TRACK', 'ROLLING', 'UNKNOWN', 'CLOSED', 'INFEASIBLE'].includes(plan.status), `${path}.status`);
    for (const key of ['apply_start_date', 'deadline_date', 'recommended_start_date', 'issue_not_before_date', 'dept_name', 'dept_tel', 'reason']) requireValue(nullableText(plan[key]), `${path}.${key}`);
    requireValue(sourceUrl(plan.origin_url), `${path}.origin_url`);
    for (const key of ['apply_start_date', 'deadline_date', 'recommended_start_date', 'issue_not_before_date']) requireValue(date(plan[key]), `${path}.${key}`);
    // slack_business_days is signed: an INFEASIBLE plan is short on time, so it goes
    // negative (documents[0] not ready before the deadline) rather than clamping at 0.
    requireValue(plan.slack_business_days === undefined || plan.slack_business_days === null || integer(plan.slack_business_days), `${path}.slack_business_days`);
    for (const key of ['business_days_to_deadline', 'preparation_business_days']) requireValue(plan[key] === undefined || plan[key] === null || count(plan[key]), `${path}.${key}`);
    for (const key of ['estimated', 'outside_calendar_coverage']) requireValue(plan[key] === undefined || typeof plan[key] === 'boolean', `${path}.${key}`);
    requireValue(Array.isArray(plan.documents), `${path}.documents`);
    plan.documents.forEach((document, documentIndex) => validateDocument(document, `${path}.documents[${documentIndex}]`));
    requireValue(!policyIds.has(plan.policy_id), `${path}.policy_id`); policyIds.add(plan.policy_id);
  });
  const planCounts = { urgent: 0, on_track: 0, rolling: 0, unknown_deadline: 0, closed: 0, infeasible: 0 };
  data.plans.forEach(plan => {
    const key = { URGENT: 'urgent', ON_TRACK: 'on_track', ROLLING: 'rolling', UNKNOWN: 'unknown_deadline', CLOSED: 'closed', INFEASIBLE: 'infeasible' }[plan.status];
    planCounts[key]++;
  });
  for (const key of Object.keys(planCounts)) requireValue(planCounts[key] === data.summary[key], `summary.${key}`);
  requireValue(data.summary.total === data.plans.length, 'summary.total');
  data.documents.forEach((document, index) => {
    const path = `documents[${index}]`;
    requireValue(object(document) && text(document.name), path);
    for (const key of ['doc_code', 'issuer', 'issue_kind', 'channel', 'notes']) requireValue(nullableText(document[key]), `${path}.${key}`);
    for (const key of ['lead_time_business_days', 'lead_time_min_business_days', 'cost_krw', 'validity_days']) requireValue(document[key] === undefined || document[key] === null || count(document[key]), `${path}.${key}`);
    for (const key of ['lead_time_estimated', 'requires_visit', 'master_unverified', 'single_issue_covers_all']) requireValue(document[key] === undefined || typeof document[key] === 'boolean', `${path}.${key}`);
    for (const key of ['needed_by_date', 'issue_not_before']) requireValue(date(document[key]), `${path}.${key}`);
    for (const key of ['required_by', 'required_by_titles']) requireValue(Array.isArray(document[key]) && document[key].every(text), `${path}.${key}`);
  });
  return data;
}
