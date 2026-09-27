import { createJudgementApi } from '../src/judgement-api.js';
import { createQuestionApi } from '../src/question-api.js';
import { createCombinationApi } from '../src/combination-api.js';
import { createPlanApi } from '../src/plan-api.js';
import { createProfileApi } from '../src/profile-api.js';
import { writeFile } from 'node:fs/promises';

const baseUrl = process.env.YPC_API_BASE;
if (!baseUrl || !/^https?:\/\//.test(baseUrl)) throw new Error('Set YPC_API_BASE to the backend URL.');
const origin = process.env.YPC_FE_ORIGIN || 'http://127.0.0.1:5173';
// Synthetic fixture only. No real user profile or session is read by this tool.
const profile = {
  core: { birth_date: '2001-03-15', region_code: '41190', residence_start_date: '2024-04-01', residence_continuous: true,
    education: 'university_graduated', employment_status: 'job_seeking', employment_start_date: null,
    marital_status: 'single', household_size: 1, income_basis: 'self_only', household_income_ratio_median: 85 },
  history: { received_policy_ids: [], similar_program_participation_2y: null }, answers: {},
  consent: { terms_version: '1.0', privacy_agreed_at: new Date().toISOString(), retention_days: 1 },
};
const report = { checkedAt: new Date().toISOString(), baseUrl, origin, syntheticProfile: true, checks: [] };
async function check(name, action) {
  try { const details = await action(); report.checks.push({ name, passed: true, details }); return details; }
  catch (error) { report.checks.push({ name, passed: false, code: error.code, status: error.status, detail: error.detail, message: error.message }); }
}
const fetchImpl = (url, options = {}) => fetch(url, { ...options, signal: options.signal ?? AbortSignal.timeout(45000) });
const options = { baseUrl, fetchImpl, timeoutMs: 45000 };
await check('ready', async () => {
  const response = await fetchImpl(`${baseUrl}/readyz`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
});
await check('policies', async () => {
  const response = await fetchImpl(`${baseUrl}/v1/policies?limit=5`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const value = await response.json();
  return { total: value.total, titles: value.items.map(item => item.title), snapshot: value.snapshot_version };
});
await check('cors-preflight', async () => {
  const response = await fetchImpl(`${baseUrl}/v1/judge`, { method: 'OPTIONS', headers: { Origin: origin,
    'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-session-id' } });
  const allow = response.headers.get('access-control-allow-origin');
  if (!response.ok || (allow !== origin && allow !== '*')) throw Object.assign(new Error(`Preflight HTTP ${response.status}, allow-origin=${allow}`), { status: response.status });
  return { status: response.status, allowOrigin: allow };
});
const judge = createJudgementApi(options);
await check('judge', async () => { const result = await judge.judge(profile); return { summary: result.summary, snapshot: result.snapshot_version }; });
const queue = await check('questions', () => createQuestionApi(options).list(profile));
if (queue) {
  const answer = queue.questions.find(question => question.field === 'similar_program_participation_2y' && question.answer_type === 'boolean');
  if (answer) {
    profile.answers[answer.field] = false;
    await check('rejudge-with-answer', async () => ({ summary: (await judge.judge(profile)).summary }));
  }
}
await check('combinations', async () => {
  const result = await createCombinationApi(options).list(profile);
  return { keys: Object.keys(result) };
});
await check('plan', async () => {
  const result = await createPlanApi(options).list(profile);
  return { plans: result.plans?.length, documents: result.documents?.length };
});
const memory = new Map();
const sessions = createProfileApi({ baseUrl, fetchImpl, storage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) } });
try {
  await check('session-create-read-update', async () => {
    await sessions.create(profile);
    const saved = await sessions.get();
    if (saved?.core?.region_code !== profile.core.region_code) throw new Error('Saved profile mismatch');
    await sessions.put(profile);
    return { created: true, read: true, updated: true };
  });
} finally {
  if (sessions.sessionId) await check('session-cleanup', async () => ({ deleted: await sessions.remove() }));
}
if (process.env.YPC_CHECK_REPORT) await writeFile(process.env.YPC_CHECK_REPORT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.checks.some(item => !item.passed)) process.exitCode = 1;
