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
 */
import { describe, expect, it } from 'bun:test';
import { CaseEngine } from '../case-engine';
import { EvidenceFabric } from '../evidence-fabric';
import { Ledger } from '../ledger';
import { LearningLedger, ProvisionalLessonError } from '../learning-ledger';
import { KnowledgeLedger } from '../knowledge-ledger';
import { decisionEvidenceToMeshEvidence, counterfactualToReplay } from '../../adapters/risk-replay/map';
import type { RiskReplayCounterfactualOut, RiskReplayDecisionDetail } from '../../adapters/risk-replay/client';
import type { Case, Lesson } from '../../contracts/schemas';

import decisionDetailFixture from '../../adapters/risk-replay/__fixtures__/decision-detail.dec-001.json';
import counterfactualFixture from '../../adapters/risk-replay/__fixtures__/counterfactual.dec-001.remove-e3.json';

const AT = '2026-09-23T10:00:00.000Z';
const detail = decisionDetailFixture as unknown as RiskReplayDecisionDetail;
const counterfactual = counterfactualFixture as unknown as RiskReplayCounterfactualOut;

describe('golden case: DEC-001 lesson stays PROVISIONAL forever (risk-replay demo data)', () => {
  it('walks CASE -> EVIDENCE -> REPLAY -> LESSON, and blocks ADOPTED at the real guard', () => {
    const ledger = new Ledger();
    const cases = new CaseEngine(ledger);
    const evidence = new EvidenceFabric(ledger);
    const learning = new LearningLedger(ledger);
    const knowledge = new KnowledgeLedger(ledger);

    const mesh_case: Case = {
      id: 'case-dec-001-lesson', schema_version: '1.0', created_at: AT, source: 'risk-replay-adapter',
      status: 'INVESTIGATING',
      provenance: { source: 'SIMULATED', system: 'risk-replay-backend', retrieved_at: AT, upstream_ref: detail.decision_id, note: 'risk-replay golden_dataset.py seed data, not a real incident' },
      title: `risk-replay decision ${detail.decision_id} (${detail.system})`,
      summary: `Original decision: ${detail.decision} at confidence ${detail.confidence}.`,
      signal_ids: [], entity_ids: [detail.system], behavior_ids: [], decision_ids: [],
      disagreement_ids: [], challenge_ids: [], replay_ids: [], outcome_id: null, lesson_ids: [],
    };
    cases.create(mesh_case);

    const evidenceItems = decisionEvidenceToMeshEvidence(detail, mesh_case.id, AT);
    for (const item of evidenceItems) {
      evidence.add({ ...item, reliability: 0.5, independent: true });
      cases.attachEvidence(mesh_case.id, item.id, AT);
    }

    const replay = counterfactualToReplay(counterfactual, mesh_case.id, detail.decision_id, 'REMOVE_EVIDENCE', AT);
    cases.attachReplay(mesh_case.id, replay.id, AT);

    // The lesson's content is derived from the real replay finding, not invented. There is no
    // recorded real-world actual_outcome for DEC-001 anywhere in risk-replay's fixtures — that
    // absence is stated honestly rather than fabricated, and is itself the reason this lesson can
    // never be validated against ground truth, independent of the provenance guard below.
    const lesson: Lesson = {
      id: 'lesson-dec-001-e3-fragility', schema_version: '1.0', created_at: AT, source: 'mesh-golden-case',
      status: 'CANDIDATE',
      provenance: mesh_case.provenance,
      source_case_id: mesh_case.id,
      original_prediction: `${detail.decision} (confidence ${detail.confidence}, risk_score ${detail.risk_score})`,
      actual_outcome: 'none recorded — DEC-001 has no real-world ground truth in risk-replay\'s fixtures',
      error_type: 'FRAGILE_UNDER_REPLAY',
      root_cause: replay.finding,
      affected_models: [detail.model_id],
      affected_rules: [detail.policy_id],
      version: 1,
    };

    learning.propose(lesson);
    learning.transition(lesson.id, 'VERIFIED', 'reviewed by golden case', AT);
    learning.transition(lesson.id, 'VALIDATED', 'root cause confirmed against the real replay finding', AT);
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
