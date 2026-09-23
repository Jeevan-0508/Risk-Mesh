/**
 * Shared golden-case scenario builders. Extracted so the two golden-case tests
 * (`dec-001-fragile-replay.test.ts`, `dec-001-lesson-provisional.test.ts`) and the Observatory's
 * capture script (`observatory/scripts/capture-golden-events.ts`) run the exact same code, not a
 * second hand-copied version that could silently drift from what the tests actually verify. If the
 * Observatory shows an event, it is because this function really produced it and a test asserts it.
 *
 * DEC-001 is risk-replay's own seeded demo/golden-dataset decision, not a real incident — SIMULATED
 * throughout, never presented as a real fraud case.
 */
import { CaseEngine } from '../case-engine';
import { EvidenceFabric } from '../evidence-fabric';
import { Ledger } from '../ledger';
import { LearningLedger } from '../learning-ledger';
import { KnowledgeLedger } from '../knowledge-ledger';
import { decisionEvidenceToMeshEvidence, counterfactualToReplay } from '../../adapters/risk-replay/map';
import type { RiskReplayCounterfactualOut, RiskReplayDecisionDetail } from '../../adapters/risk-replay/client';
import type { Case, Lesson, Replay } from '../../contracts/schemas';

import decisionDetailFixture from '../../adapters/risk-replay/__fixtures__/decision-detail.dec-001.json';
import counterfactualFixture from '../../adapters/risk-replay/__fixtures__/counterfactual.dec-001.remove-e3.json';

export const AT = '2026-09-23T10:00:00.000Z';
export const detail = decisionDetailFixture as unknown as RiskReplayDecisionDetail;
export const counterfactual = counterfactualFixture as unknown as RiskReplayCounterfactualOut;

export interface FragileReplayScenario {
  ledger: Ledger;
  cases: CaseEngine;
  evidence: EvidenceFabric;
  mesh_case: Case;
  replay: Replay;
}

export function buildFragileReplayScenario(caseId = 'case-dec-001'): FragileReplayScenario {
  const ledger = new Ledger();
  const cases = new CaseEngine(ledger);
  const evidence = new EvidenceFabric(ledger);

  const mesh_case: Case = {
    id: caseId, schema_version: '1.0', created_at: AT, source: 'risk-replay-adapter',
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

  return { ledger, cases, evidence, mesh_case, replay };
}

export interface LessonProvisionalScenario extends FragileReplayScenario {
  learning: LearningLedger;
  knowledge: KnowledgeLedger;
  lesson: Lesson;
}

export function buildLessonProvisionalScenario(caseId = 'case-dec-001-lesson'): LessonProvisionalScenario {
  const base = buildFragileReplayScenario(caseId);
  const learning = new LearningLedger(base.ledger);
  const knowledge = new KnowledgeLedger(base.ledger);

  // The lesson's content is derived from the real replay finding, not invented. There is no
  // recorded real-world actual_outcome for DEC-001 anywhere in risk-replay's fixtures — that
  // absence is stated honestly rather than fabricated, and is itself the reason this lesson can
  // never be validated against ground truth, independent of the provenance guard below.
  const lesson: Lesson = {
    id: `lesson-${caseId}-e3-fragility`, schema_version: '1.0', created_at: AT, source: 'mesh-golden-case',
    status: 'CANDIDATE',
    provenance: base.mesh_case.provenance,
    source_case_id: base.mesh_case.id,
    original_prediction: `${detail.decision} (confidence ${detail.confidence}, risk_score ${detail.risk_score})`,
    actual_outcome: 'none recorded — DEC-001 has no real-world ground truth in risk-replay\'s fixtures',
    error_type: 'FRAGILE_UNDER_REPLAY',
    root_cause: base.replay.finding,
    affected_models: [detail.model_id],
    affected_rules: [detail.policy_id],
    version: 1,
  };

  learning.propose(lesson);
  learning.transition(lesson.id, 'VERIFIED', 'reviewed by golden case', AT);
  learning.transition(lesson.id, 'VALIDATED', 'root cause confirmed against the real replay finding', AT);

  return { ...base, learning, knowledge, lesson };
}
