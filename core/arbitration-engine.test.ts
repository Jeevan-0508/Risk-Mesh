import { describe, expect, it } from 'bun:test';
import { decideArbitrationAction, decideSystem1Action, type ArbitrationContext, type System1Context } from './arbitration-engine';
import { computeTrustVerdict } from './trust-engine';
import type { TrustAssessment, TrustReason } from './trust-engine';
import type { Disagreement, ModelResult, TrustVerdict } from '../contracts/schemas';

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


const ANY_SYSTEM1_CONTEXT: System1Context = { swarmAvailable: false, jevAvailable: false, caseRisk: 'STANDARD' };

function modelResult(overrides: Partial<ModelResult> = {}): ModelResult {
  return {
    id: 'test-modelresult-1',
    schema_version: '1.0',
    created_at: '2026-09-23T12:00:00.000Z',
    source: 'test',
    provenance: { source: 'LIVE', system: 'test', retrieved_at: '2026-09-23T12:00:00.000Z', upstream_ref: null, note: 'test fixture' },
    status: 'RECORDED',
    case_id: 'case-test-1',
    model_id: 'laya-typed',
    checkpoint: 'convaiinnovations/laya-typed-decisions',
    decision: 'inconclusive',
    probabilities: { a: 0.5, b: 0.5 },
    confidence: 0.02,
    uncertainty: 0.9,
    primitive: 'choice',
    latency_ms: 400,
    raw_output: {},
    ...overrides,
  };
}

function disagreement(overrides: Partial<Disagreement> = {}): Disagreement {
  return {
    id: 'test-disagreement-1',
    schema_version: '1.0',
    created_at: '2026-09-23T12:00:00.000Z',
    source: 'test',
    provenance: { source: 'LIVE', system: 'test', retrieved_at: '2026-09-23T12:00:00.000Z', upstream_ref: null, note: 'test fixture' },
    status: 'OPEN',
    case_id: 'case-test-1',
    model_ids: ['laya-typed', 'laya-english'],
    positions: [
      { model_id: 'laya-typed', stance: 'inconclusive', confidence: 0.02 },
      { model_id: 'laya-english', stance: 'consistent', confidence: 0.06 },
    ],
    resolution: null,
    ...overrides,
  };
}

describe('decideSystem1Action', () => {
  it('a HIGH-risk case always goes to REQUIRE_DEEP_REVIEW, regardless of any model signal - checked first', () => {
    const decision = decideSystem1Action(
      { results: [modelResult({ uncertainty: 0.01 })], modelAgreementScore: 0.95, disagreement: null },
      { ...ANY_SYSTEM1_CONTEXT, caseRisk: 'HIGH' },
    );
    expect(decision.action).toBe('REQUIRE_DEEP_REVIEW');
    expect(decision.rationale.length).toBeGreaterThan(0);
  });

  it('no results at all defers to HUMAN_REVIEW rather than guessing', () => {
    const decision = decideSystem1Action({ results: [], modelAgreementScore: null, disagreement: null }, ANY_SYSTEM1_CONTEXT);
    expect(decision.action).toBe('HUMAN_REVIEW');
  });

  it('2+ models that agree get ACCEPT_SYSTEM1, distinct from a plain ACCEPT', () => {
    const decision = decideSystem1Action(
      { results: [modelResult({ model_id: 'laya-typed' }), modelResult({ model_id: 'laya-english' })], modelAgreementScore: 0.9, disagreement: null },
      ANY_SYSTEM1_CONTEXT,
    );
    expect(decision.action).toBe('ACCEPT_SYSTEM1');
    expect(decision.rationale.join(' ')).toContain('SHADOW');
  });

  it('2+ models that disagree escalate to the swarm when it is reachable', () => {
    const decision = decideSystem1Action(
      { results: [modelResult(), modelResult({ model_id: 'laya-english' })], modelAgreementScore: 0.15, disagreement: disagreement() },
      { ...ANY_SYSTEM1_CONTEXT, swarmAvailable: true },
    );
    expect(decision.action).toBe('ESCALATE_TO_SWARM');
  });

  it('2+ models that disagree fall back to HUMAN_REVIEW when the swarm is not connected, never fabricating the connection', () => {
    const decision = decideSystem1Action(
      { results: [modelResult(), modelResult({ model_id: 'laya-english' })], modelAgreementScore: 0.15, disagreement: disagreement() },
      { ...ANY_SYSTEM1_CONTEXT, swarmAvailable: false },
    );
    expect(decision.action).toBe('HUMAN_REVIEW');
    expect(decision.rationale.join(' ')).toContain('not connected');
  });

  it('a single confident model (low uncertainty, nothing yet to compare against) gets a plain ACCEPT', () => {
    const decision = decideSystem1Action(
      { results: [modelResult({ uncertainty: 0.1 })], modelAgreementScore: null, disagreement: null },
      ANY_SYSTEM1_CONTEXT,
    );
    expect(decision.action).toBe('ACCEPT');
  });

  it('a single uncertain model calls Jev next when Jev is reachable', () => {
    const decision = decideSystem1Action(
      { results: [modelResult({ uncertainty: 0.95 })], modelAgreementScore: null, disagreement: null },
      { ...ANY_SYSTEM1_CONTEXT, jevAvailable: true },
    );
    expect(decision.action).toBe('CALL_JEV');
  });

  it('a single uncertain model escalates to the swarm instead, since Jev is UNAVAILABLE in this environment', () => {
    const decision = decideSystem1Action(
      { results: [modelResult({ uncertainty: 0.95 })], modelAgreementScore: null, disagreement: null },
      { ...ANY_SYSTEM1_CONTEXT, jevAvailable: false, swarmAvailable: true },
    );
    expect(decision.action).toBe('ESCALATE_TO_SWARM');
    expect(decision.rationale.join(' ')).toContain('UNAVAILABLE');
  });

  it('a single uncertain model with neither Jev nor the swarm reachable defers to HUMAN_REVIEW', () => {
    const decision = decideSystem1Action(
      { results: [modelResult({ uncertainty: 0.95 })], modelAgreementScore: null, disagreement: null },
      { ...ANY_SYSTEM1_CONTEXT, jevAvailable: false, swarmAvailable: false },
    );
    expect(decision.action).toBe('HUMAN_REVIEW');
  });

  it('a single model with no probability distribution at all (uncertainty null) is treated as too little signal to accept alone, never defaulted to confident', () => {
    const decision = decideSystem1Action(
      { results: [modelResult({ uncertainty: null, probabilities: null })], modelAgreementScore: null, disagreement: null },
      { ...ANY_SYSTEM1_CONTEXT, swarmAvailable: true },
    );
    expect(decision.action).toBe('ESCALATE_TO_SWARM');
  });
});
