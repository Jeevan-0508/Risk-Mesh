/**
 * A first, small "golden case" (spec §48): connects the tissue this session actually built —
 * contracts, evidence fabric, case engine, ledger, and the live-verified risk-replay adapter — end
 * to end over one real captured decision.
 *
 * DEC-001 is risk-replay's own seeded demo/golden-dataset decision (`backend/app/golden_dataset.py`),
 * not a real incident — labelled SIMULATED throughout, never presented as a real fraud case.
 */
import { describe, expect, it } from 'bun:test';
import { CaseEngine } from '../case-engine';
import { EvidenceFabric } from '../evidence-fabric';
import { Ledger } from '../ledger';
import { decisionEvidenceToMeshEvidence, counterfactualToReplay } from '../../adapters/risk-replay/map';
import type { RiskReplayCounterfactualOut, RiskReplayDecisionDetail } from '../../adapters/risk-replay/client';
import type { Case } from '../../contracts/schemas';

import decisionDetailFixture from '../../adapters/risk-replay/__fixtures__/decision-detail.dec-001.json';
import counterfactualFixture from '../../adapters/risk-replay/__fixtures__/counterfactual.dec-001.remove-e3.json';

const AT = '2026-09-23T10:00:00.000Z';
const detail = decisionDetailFixture as unknown as RiskReplayDecisionDetail;
const counterfactual = counterfactualFixture as unknown as RiskReplayCounterfactualOut;

describe('golden case: DEC-001 fragile-under-replay (risk-replay demo data)', () => {
  it('walks CASE -> EVIDENCE -> REPLAY -> reconstruct, using only real captured risk-replay data', () => {
    const ledger = new Ledger();
    const cases = new CaseEngine(ledger);
    const evidence = new EvidenceFabric(ledger);

    const mesh_case: Case = {
      id: 'case-dec-001', schema_version: '1.0', created_at: AT, source: 'risk-replay-adapter',
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

    const reconstructed = cases.get(mesh_case.id)!;
    expect(reconstructed.evidence_ids?.length).toBe(4);
    expect(reconstructed.replay_ids).toEqual([replay.id]);
    expect(replay.status).toBe('FRAGILE');

    // What actually happened is answerable by walking ledger events for this case, not by trusting
    // memory. Each evidence item logs twice on purpose: once when it enters the fabric
    // (EvidenceFabric.add), once when this case links to it (CaseEngine.attachEvidence) — two real,
    // distinct actions, both legitimately EVIDENCE_ADDED under spec §42's fixed vocabulary.
    const trail = ledger.forCase(mesh_case.id).map((e) => e.type);
    expect(trail).toEqual([
      'CASE_CREATED',
      'EVIDENCE_ADDED', 'EVIDENCE_ADDED', 'EVIDENCE_ADDED', 'EVIDENCE_ADDED',
      'EVIDENCE_ADDED', 'EVIDENCE_ADDED', 'EVIDENCE_ADDED', 'EVIDENCE_ADDED',
      'REPLAY',
    ]);
  });
});
