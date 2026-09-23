import { describe, expect, it } from 'bun:test';
import { LearningLedger, IllegalLessonTransitionError, ProvisionalLessonError } from './learning-ledger';
import { Ledger } from './ledger';
import type { Lesson } from '../contracts/schemas';

const AT = '2026-09-23T10:00:00.000Z';
const makeLesson = (overrides: Partial<Lesson> = {}): Lesson => ({
  id: 'lesson-1', schema_version: '1.0', created_at: AT, source: 'test', status: 'CANDIDATE',
  provenance: { source: 'SIMULATED', system: 'test', retrieved_at: AT, upstream_ref: null, note: null },
  source_case_id: 'case-1', original_prediction: 'ALLOW', actual_outcome: 'was fraud',
  error_type: 'false_negative', root_cause: 'evidence E3 was never checked against the taxonomy',
  affected_models: [], affected_rules: [], version: 1,
  ...overrides,
});

describe('LearningLedger', () => {
  it('propose() writes a LESSON_PROPOSED ledger event', () => {
    const ledger = new Ledger();
    const learning = new LearningLedger(ledger);
    learning.propose(makeLesson());
    expect(ledger.ofType('LESSON_PROPOSED').length).toBe(1);
  });

  it('propose() rejects a lesson that does not start as CANDIDATE — no shortcutting the pipeline', () => {
    const learning = new LearningLedger(new Ledger());
    expect(() => learning.propose(makeLesson({ status: 'VERIFIED' }))).toThrow();
  });

  it('allows the full real path CANDIDATE -> VERIFIED -> VALIDATED -> ADOPTED for a non-SIMULATED lesson', () => {
    const learning = new LearningLedger(new Ledger());
    learning.propose(makeLesson({ provenance: { source: 'SNAPSHOT', system: 'test', retrieved_at: AT, upstream_ref: null, note: null } }));
    learning.transition('lesson-1', 'VERIFIED', 'source case outcome confirmed real, not simulated', AT);
    learning.transition('lesson-1', 'VALIDATED', 'no contradiction against adopted knowledge', AT);
    const final = learning.transition('lesson-1', 'ADOPTED', 'benchmark run clean', AT);
    expect(final.status).toBe('ADOPTED');
  });

  it('reaching VALIDATED writes a dedicated LESSON_VALIDATED event, not the generic one', () => {
    const ledger = new Ledger();
    const learning = new LearningLedger(ledger);
    learning.propose(makeLesson());
    learning.transition('lesson-1', 'VERIFIED', 'ok', AT);
    learning.transition('lesson-1', 'VALIDATED', 'ok', AT);
    expect(ledger.ofType('LESSON_VALIDATED').length).toBe(1);
    expect(ledger.ofType('LESSON_STATUS_CHANGED').length).toBe(1);
  });

  it('allows REJECTED from CANDIDATE, VERIFIED, or VALIDATED — "any point" per the lifecycle diagram', () => {
    const learning = new LearningLedger(new Ledger());
    learning.propose(makeLesson());
    const rejected = learning.transition('lesson-1', 'REJECTED', 'root cause was never real', AT);
    expect(rejected.status).toBe('REJECTED');
  });

  it('rejects CANDIDATE -> ADOPTED directly, skipping VERIFIED and VALIDATED', () => {
    const learning = new LearningLedger(new Ledger());
    learning.propose(makeLesson());
    expect(() => learning.transition('lesson-1', 'ADOPTED', 'skip ahead', AT)).toThrow(IllegalLessonTransitionError);
  });

  it('rejects any transition out of a terminal status (REJECTED, SUPERSEDED, DECAYED)', () => {
    const learning = new LearningLedger(new Ledger());
    learning.propose(makeLesson());
    learning.transition('lesson-1', 'REJECTED', 'debunked', AT);
    expect(() => learning.transition('lesson-1', 'VERIFIED', 'reconsidered', AT)).toThrow(IllegalLessonTransitionError);
  });

  it('allows ADOPTED -> SUPERSEDED and ADOPTED -> DECAYED, never back to VALIDATED', () => {
    const learning = new LearningLedger(new Ledger());
    learning.propose(makeLesson({ provenance: { source: 'SNAPSHOT', system: 'test', retrieved_at: AT, upstream_ref: null, note: null } }));
    learning.transition('lesson-1', 'VERIFIED', 'ok', AT);
    learning.transition('lesson-1', 'VALIDATED', 'ok', AT);
    learning.transition('lesson-1', 'ADOPTED', 'ok', AT);
    const superseded = learning.transition('lesson-1', 'SUPERSEDED', 'newer lesson replaces this', AT);
    expect(superseded.status).toBe('SUPERSEDED');
    expect(() => learning.transition('lesson-1', 'VALIDATED', 'reconsidered', AT)).toThrow(IllegalLessonTransitionError);
  });

  it('blocks ADOPTED forever for a lesson learned from a SIMULATED case, even after VALIDATED (LEARNING_MODEL.md\'s PROVISIONAL rule)', () => {
    const learning = new LearningLedger(new Ledger());
    learning.propose(makeLesson({ provenance: { source: 'SIMULATED', system: 'test', retrieved_at: AT, upstream_ref: null, note: null } }));
    learning.transition('lesson-1', 'VERIFIED', 'ok', AT);
    learning.transition('lesson-1', 'VALIDATED', 'ok', AT);
    expect(() => learning.transition('lesson-1', 'ADOPTED', 'benchmark clean', AT)).toThrow(ProvisionalLessonError);
  });

  it('does not block ADOPTED for a lesson learned from a non-SIMULATED case (e.g. SNAPSHOT)', () => {
    const learning = new LearningLedger(new Ledger());
    learning.propose(makeLesson({ provenance: { source: 'SNAPSHOT', system: 'test', retrieved_at: AT, upstream_ref: null, note: null } }));
    learning.transition('lesson-1', 'VERIFIED', 'ok', AT);
    learning.transition('lesson-1', 'VALIDATED', 'ok', AT);
    const adopted = learning.transition('lesson-1', 'ADOPTED', 'benchmark clean', AT);
    expect(adopted.status).toBe('ADOPTED');
  });

  it('list(caseId) filters by source_case_id', () => {
    const learning = new LearningLedger(new Ledger());
    learning.propose(makeLesson({ id: 'lesson-1', source_case_id: 'case-1' }));
    learning.propose(makeLesson({ id: 'lesson-2', source_case_id: 'case-2' }));
    expect(learning.list('case-1').map((l) => l.id)).toEqual(['lesson-1']);
  });
});
