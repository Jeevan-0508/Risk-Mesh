import { describe, expect, it } from 'bun:test';
import { decideArbitrationAction, type ArbitrationContext } from './arbitration-engine';
import { computeTrustVerdict } from './trust-engine';
import type { TrustAssessment, TrustReason } from './trust-engine';
import type { TrustVerdict } from '../contracts/schemas';

const ANY_CONTEXT: ArbitrationContext = { swarmAvailable: false, replayAlreadyRun: true, moreEvidenceRequestable: false };

function assessment(verdict: TrustVerdict, reason: TrustReason): TrustAssessment {
  return { verdict, reason, reasonNote: `test reason for ${reason}` };
}

describe('decideArbitrationAction', () => {
  it('every decision carries a non-empty rationale, never a bare action label', () => {
    for (const [verdict, reason] of [
      ['BLOCKED', 'EVIDENCE_QUALITY_BELOW_FLOOR'],
      ['ESCALATE', 'MODEL_DISAGREEMENT'],
      ['UNCERTAIN', 'INSUFFICIENT_SIGNAL'],
      ['CONDITIONAL', 'REPLAY_FRAGILE'],
      ['TRUSTED', 'ALL_DRIVERS_STRONG'],
    ] as const) {
      const decision = decideArbitrationAction(assessment(verdict, reason), ANY_CONTEXT);
      expect(decision.rationale.length).toBeGreaterThan(0);
      for (const r of decision.rationale) expect(r.length).toBeGreaterThan(0);
    }
  });

  it('BLOCKED always goes to HUMAN_REVIEW — MESH never auto-rejects alone', () => {
    const decision = decideArbitrationAction(assessment('BLOCKED', 'UNRESOLVED_CONTRADICTION'), ANY_CONTEXT);
    expect(decision.action).toBe('HUMAN_REVIEW');
  });

  it('ESCALATE goes to ESCALATE_TO_SWARM when risk-swarm is actually reachable', () => {
    const decision = decideArbitrationAction(assessment('ESCALATE', 'MODEL_DISAGREEMENT'), { ...ANY_CONTEXT, swarmAvailable: true });
    expect(decision.action).toBe('ESCALATE_TO_SWARM');
  });

  it('ESCALATE falls back to HUMAN_REVIEW when risk-swarm is not connected, never fabricating the connection', () => {
    const decision = decideArbitrationAction(assessment('ESCALATE', 'HIGH_NOVELTY'), { ...ANY_CONTEXT, swarmAvailable: false });
    expect(decision.action).toBe('HUMAN_REVIEW');
    expect(decision.rationale.join(' ')).toContain('not connected');
  });

  it('UNCERTAIN requests a replay first when one has not been attempted yet', () => {
    const decision = decideArbitrationAction(assessment('UNCERTAIN', 'INSUFFICIENT_SIGNAL'), { ...ANY_CONTEXT, replayAlreadyRun: false });
    expect(decision.action).toBe('REQUEST_REPLAY');
  });

  it('UNCERTAIN requests more evidence once replay has already run and a gap can be named', () => {
    const decision = decideArbitrationAction(assessment('UNCERTAIN', 'INSUFFICIENT_SIGNAL'), { ...ANY_CONTEXT, replayAlreadyRun: true, moreEvidenceRequestable: true });
    expect(decision.action).toBe('REQUEST_MORE_EVIDENCE');
  });

  it('UNCERTAIN abstains rather than guess when replay has run and no further evidence gap exists', () => {
    const decision = decideArbitrationAction(assessment('UNCERTAIN', 'INSUFFICIENT_SIGNAL'), { ...ANY_CONTEXT, replayAlreadyRun: true, moreEvidenceRequestable: false });
    expect(decision.action).toBe('ABSTAIN');
  });

  it('CONDITIONAL on low independence requests more (independent) evidence when a gap can be named', () => {
    const decision = decideArbitrationAction(assessment('CONDITIONAL', 'LOW_INDEPENDENCE'), { ...ANY_CONTEXT, moreEvidenceRequestable: true });
    expect(decision.action).toBe('REQUEST_MORE_EVIDENCE');
  });

  it('CONDITIONAL on fragile replay just stays CONDITIONAL — a replay already ran, requesting another is not the fix', () => {
    const decision = decideArbitrationAction(assessment('CONDITIONAL', 'REPLAY_FRAGILE'), ANY_CONTEXT);
    expect(decision.action).toBe('CONDITIONAL');
  });

  it('TRUSTED always ACCEPTs', () => {
    const decision = decideArbitrationAction(assessment('TRUSTED', 'ALL_DRIVERS_STRONG'), ANY_CONTEXT);
    expect(decision.action).toBe('ACCEPT');
  });

  it('composes with the real trust-engine output end to end for a fully strong case', () => {
    const trust = computeTrustVerdict({
      evidence_quality: 0.9, evidence_independence: 0.9, model_calibration: 0.9, model_historical_accuracy: 0.9,
      model_agreement: 0.9, novelty: 0.1, replay_stability: 0.9, contradiction_count: 0, source_quality: 0.9, human_validation: false,
    });
    const decision = decideArbitrationAction(trust, ANY_CONTEXT);
    expect(decision.action).toBe('ACCEPT');
  });
});
