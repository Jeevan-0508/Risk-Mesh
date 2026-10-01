import { describe, expect, it } from 'bun:test';
import { LearningLedger, IllegalLessonTransitionError, ProvisionalLessonError } from './learning-ledger';
import { Ledger } from './ledger';
import type { Lesson } from '../contracts/schemas';
import { validationFixture, VERIFIED_AT as AT } from './__fixtures__/validation-fixture';
function setup(source: 'SIMULATED'|'SNAPSHOT' = 'SNAPSHOT') {
  const fixture = validationFixture({ id: 'lesson-1' }); const ledger = new Ledger();
  const learning = new LearningLedger(ledger);
  const lesson: Lesson = { id: 'lesson-1', schema_version: '1.0', created_at: AT,
    source: 'contract-test', status: 'CANDIDATE',
    provenance: { source, system: 'contract-test', retrieved_at: AT, upstream_ref: null, note: 'Illustrative test only.' },
    source_case_id: 'case-test', original_prediction: 'contract fixture', actual_outcome: 'contract fixture; no real outcome',
    error_type: 'false_negative', root_cause: fixture.candidate.statement, affected_models: [], affected_rules: [], version: 1 };
  learning.propose(lesson); return { learning, ledger, permit: fixture.permit() };
}
describe('LearningLedger controlled lifecycle', () => {
  it('requires ordered transitions and independent signed validation', () => {
    const { learning, ledger, permit } = setup();
    expect(() => learning.transition('lesson-1', 'ADOPTED', 'skip', AT, permit)).toThrow(IllegalLessonTransitionError);
    learning.transition('lesson-1', 'VERIFIED', 'source inspected', AT);
    expect(() => learning.transition('lesson-1', 'VALIDATED', 'model agrees', AT)).toThrow('permit');
    learning.transition('lesson-1', 'VALIDATED', 'configured review passed', AT, permit);
    expect(learning.transition('lesson-1', 'ADOPTED', 'regression passed', AT, permit).status).toBe('ADOPTED');
    expect(ledger.ofType('LESSON_VALIDATED')).toHaveLength(1);
  });
  it('never validates or adopts synthetic lessons even with unrelated genuine permits', () => {
    const { learning, permit } = setup('SIMULATED');
    learning.transition('lesson-1', 'VERIFIED', 'simulation consistency only', AT);
    for (const target of ['VALIDATED','ADOPTED'] as const)
      expect(() => learning.transition('lesson-1', target, 'attempt promotion', AT, permit)).toThrow(ProvisionalLessonError);
    expect(learning.get('lesson-1')?.status).toBe('VERIFIED');
  });
  it('keeps rejection terminal', () => {
    const { learning } = setup(); learning.transition('lesson-1', 'REJECTED', 'insufficient evidence', AT);
    expect(() => learning.transition('lesson-1', 'VERIFIED', 'retry', AT)).toThrow(IllegalLessonTransitionError);
  });
  it('keeps supersession terminal after gated adoption', () => {
    const { learning, permit } = setup();
    for (const target of ['VERIFIED','VALIDATED','ADOPTED','SUPERSEDED'] as const)
      learning.transition('lesson-1', target, 'contract fixture only', AT, permit);
    expect(() => learning.transition('lesson-1', 'VALIDATED', 'retry', AT, permit)).toThrow(IllegalLessonTransitionError);
  });
});
