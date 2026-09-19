import { escape } from './dom.js';

// Confidence is a separate axis from any verdict or conflict decision, so it never
// borrows the four status colours. One neutral outlined chip, shared by every screen,
// keeps PASS/FAIL/UNKNOWN/FUTURE_PASS meaning only one thing. See docs/Design-states.md (S-4).
export const confidenceLabels = { ESTIMATED: '추정 포함', NEEDS_REVIEW: '담당부서 확인' };

export const chip = confidence => confidence === 'CONFIRMED' || confidence == null ? ''
  : `<span class="chip">${escape(confidenceLabels[confidence] ?? confidence)}</span>`;
