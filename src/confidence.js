import { escape } from './dom.js';

// Confidence is a separate axis from any verdict or conflict decision, so it never
// borrows the four status colours. One neutral outlined chip, shared by every screen,
// keeps PASS/FAIL/UNKNOWN/FUTURE_PASS meaning only one thing. See docs/Design-states.md (S-4).
export const confidenceLabels = { ESTIMATED: '추정 포함', NEEDS_REVIEW: '담당부서 확인' };

export const chip = confidence => confidence === 'CONFIRMED' || confidence == null ? ''
  : `<span class="chip">${escape(confidenceLabels[confidence] ?? confidence)}</span>`;

// dept_name/dept_tel are frequently absent even on real policies (most published
// listings have no phone on file), so this never assumes either is set -- it falls
// back to the one contact BE guarantees for a non-CONFIRMED result: origin_url.
export function contactNotice({ confidence, dept_name, dept_tel, origin_url }) {
  if (confidence === 'CONFIRMED') return '';
  const whom = [dept_name, dept_tel].filter(Boolean).map(escape).join(' · ');
  const text = whom ? `${whom}로 최종 확인해 주세요.` : '아래 공고 원문에서 최종 확인해 주세요.';
  const link = origin_url ? ` <a href="${escape(origin_url)}" target="_blank" rel="noreferrer">공고 원문 보기 →</a>` : '';
  return text + link;
}
