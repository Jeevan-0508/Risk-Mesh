/**
 * A first, small "golden case" (spec §48): connects the tissue this session actually built —
 * contracts, evidence fabric, case engine, ledger, and the live-verified risk-replay adapter — end
 * to end over one real captured decision.
 *
 * DEC-001 is risk-replay's own seeded demo/golden-dataset decision (`backend/app/golden_dataset.py`),
 * not a real incident — labelled SIMULATED throughout, never presented as a real fraud case.
 *
 * Scenario setup lives in `scenarios.ts`, shared with the Observatory's capture script — this file
 * only asserts what it means for that setup to have gone correctly.
 */
import { describe, expect, it } from 'bun:test';
import { buildFragileReplayScenario } from './scenarios';

describe('golden case: DEC-001 fragile-under-replay (risk-replay demo data)', () => {
  it('walks CASE -> EVIDENCE -> REPLAY -> reconstruct, using only real captured risk-replay data', () => {
    const { ledger, cases, mesh_case, replay } = buildFragileReplayScenario();

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
