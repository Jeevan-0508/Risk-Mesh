/**
 * A second golden case (spec §48): the first golden case (`dec-001-fragile-replay.test.ts`) walks
 * CASE -> EVIDENCE -> REPLAY. This one continues from the same real DEC-001 replay finding into
 * REPLAY -> LESSON, and exists specifically to prove that `LearningLedger` enforces
 * `docs/LEARNING_MODEL.md`'s PROVISIONAL-forever rule end to end, not just in the unit test of the
 * guard alone (`core/learning-ledger.test.ts`).
 *
 * DEC-001 is risk-replay's own seeded demo/golden-dataset decision, not a real incident — SIMULATED
 * throughout. It also has no recorded real-world outcome anywhere in risk-replay's fixtures, which
 * is not a gap this case papers over: a lesson with no ground-truth `actual_outcome` to validate
 * against is exactly the kind of lesson LEARNING_MODEL.md says must stay PROVISIONAL. The case
 * argues for its own conclusion, honestly, rather than the guard being an arbitrary provenance check.
 *
 * Scenario setup lives in `scenarios.ts`, shared with the Observatory's capture script — this file
 * only asserts what it means for that setup to have gone correctly.
 */
import { describe, expect, it } from 'bun:test';
import { ProvisionalLessonError } from '../learning-ledger';
import { AT, buildLessonProvisionalScenario } from './scenarios';

describe('golden case: DEC-001 lesson stays PROVISIONAL forever (risk-replay demo data)', () => {
  it('walks CASE -> EVIDENCE -> REPLAY -> LESSON, and blocks ADOPTED at the real guard', () => {
    const { ledger, mesh_case, learning, knowledge, lesson } = buildLessonProvisionalScenario();

    expect(learning.get(lesson.id)?.status).toBe('VALIDATED');

    expect(() => learning.transition(lesson.id, 'ADOPTED', 'attempting promotion', AT))
      .toThrow(ProvisionalLessonError);
    // The guard fails before any mutation or ledger event — the lesson stays exactly where it was.
    expect(learning.get(lesson.id)?.status).toBe('VALIDATED');

    // No ADOPTED lesson exists to promote, so KnowledgeLedger.record() is correctly never called —
    // asserting an empty knowledge store here is the honest alternative to fabricating a Knowledge
    // object just to exercise the ledger.
    expect(knowledge.list()).toEqual([]);

    const trail = ledger.forCase(mesh_case.id).map((e) => e.type);
    expect(trail).toEqual([
      'CASE_CREATED',
      'EVIDENCE_ADDED', 'EVIDENCE_ADDED', 'EVIDENCE_ADDED', 'EVIDENCE_ADDED',
      'EVIDENCE_ADDED', 'EVIDENCE_ADDED', 'EVIDENCE_ADDED', 'EVIDENCE_ADDED',
      'REPLAY',
      'LESSON_PROPOSED', 'LESSON_STATUS_CHANGED', 'LESSON_VALIDATED',
    ]);
  });
});
