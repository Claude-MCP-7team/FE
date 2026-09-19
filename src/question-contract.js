import { ApiError } from './profile-api.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const answerTypes = ['boolean', 'number', 'choice'];
const fail = path => { throw new ApiError('질문 응답 형식이 올바르지 않아요. 다시 시도해 주세요.', { code: 'INVALID_RESPONSE', detail: path }); };

export function validateQuestionQueue(data) {
  if (!object(data) || !text(data.snapshot_version) || !Array.isArray(data.questions) || !integer(data.total_unresolved_fields) || !integer(data.needs_info_policies)) fail('queue');
  if (data.total_unresolved_fields < data.questions.length) fail('total_unresolved_fields');
  const fields = new Set();
  data.questions.forEach((question, index) => {
    const path = `questions[${index}]`;
    if (!object(question) || !text(question.field) || fields.has(question.field) || !text(question.text)) fail(path);
    fields.add(question.field);
    if (!integer(question.resolves) || !integer(question.affects) || question.resolves > question.affects || !answerTypes.includes(question.answer_type)) fail(`${path}.counts`);
    if (!Array.isArray(question.choices) || !question.choices.every(text) || new Set(question.choices).size !== question.choices.length) fail(`${path}.choices`);
    if (question.answer_type === 'choice' && question.choices.length === 0) fail(`${path}.choices`);
    if (question.answer_type !== 'choice' && question.choices.length > 0) fail(`${path}.choices`);
    if (typeof question.source_quote !== 'string' || !Array.isArray(question.source_policy_ids) || !question.source_policy_ids.every(text)) fail(`${path}.evidence`);
  });
  return data;
}

export function normalizeAnswers(questions, input) {
  if (!Array.isArray(questions) || !object(input)) throw new ApiError('답변을 확인해 주세요.', { code: 'INVALID_ANSWERS' });
  const definitions = new Map(questions.map(question => [question.field, question]));
  const answers = {};
  for (const [field, raw] of Object.entries(input)) {
    const question = definitions.get(field);
    if (!question || raw === '' || raw === null || raw === undefined) continue;
    if (question.answer_type === 'boolean') {
      if (raw !== true && raw !== false && raw !== 'true' && raw !== 'false') throw new ApiError('예/아니오 답변을 선택해 주세요.', { code: 'INVALID_ANSWERS', detail: field });
      answers[field] = raw === true || raw === 'true';
    } else if (question.answer_type === 'number') {
      const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (!Number.isSafeInteger(value) || value < 0) throw new ApiError('0 이상의 정수를 입력해 주세요.', { code: 'INVALID_ANSWERS', detail: field });
      answers[field] = value;
    } else {
      if (!question.choices.includes(raw)) throw new ApiError('목록에서 답변을 선택해 주세요.', { code: 'INVALID_ANSWERS', detail: field });
      answers[field] = raw;
    }
  }
  return answers;
}
