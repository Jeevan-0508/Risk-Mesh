import { describe, expect, it } from 'bun:test';
import { computeTrustVerdict, TRUST_THRESHOLDS } from './trust-engine';
import type { TrustDrivers } from '../contracts/schemas';

const STRONG: TrustDrivers = {
  evidence_quality: 0.9,
  evidence_independence: 0.9,
  model_calibration: 0.9,
  model_historical_accuracy: 0.9,
  model_agreement: 0.9,
  novelty: 0.1,
  replay_stability: 0.9,
  contradiction_count: 0,
  source_quality: 0.9,
  human_validation: false,
};

describe('computeTrustVerdict', () => {
  it('is TRUSTED when every driver clears its declared floor', () => {
    const result = computeTrustVerdict(STRONG);
    expect(result.verdict).toBe('TRUSTED');
    expect(result.reason).toBe('ALL_DRIVERS_STRONG');
  });

  it('is BLOCKED on any unresolved contradiction when no human has validated past it', () => {
    const result = computeTrustVerdict({ ...STRONG, contradiction_count: 2, human_validation: false });
    expect(result.verdict).toBe('BLOCKED');
    expect(result.reason).toBe('UNRESOLVED_CONTRADICTION');
  });

  it('does not block on a contradiction a human has already validated past', () => {
    const result = computeTrustVerdict({ ...STRONG, contradiction_count: 2, human_validation: true });
    expect(result.verdict).not.toBe('BLOCKED');
  });

  it(`is BLOCKED when evidence_quality is below the floor (${TRUST_THRESHOLDS.evidenceQualityFloor}), even with human_validation`, () => {
    const result = computeTrustVerdict({ ...STRONG, evidence_quality: 0.1, human_validation: true });
    expect(result.verdict).toBe('BLOCKED');
    expect(result.reason).toBe('EVIDENCE_QUALITY_BELOW_FLOOR');
  });

  it(`is ESCALATE when model_agreement is below the floor (${TRUST_THRESHOLDS.modelAgreementFloor}) — a disagreement is never averaged away`, () => {
    const result = computeTrustVerdict({ ...STRONG, model_agreement: 0.2 });
    expect(result.verdict).toBe('ESCALATE');
    expect(result.reason).toBe('MODEL_DISAGREEMENT');
  });

  it('does not fail on model_agreement being null — no models were involved, so it is simply not consulted', () => {
    const result = computeTrustVerdict({ ...STRONG, model_agreement: null });
    expect(result.verdict).toBe('TRUSTED');
  });

  it(`is ESCALATE when novelty is above the ceiling (${TRUST_THRESHOLDS.noveltyEscalateCeiling})`, () => {
    const result = computeTrustVerdict({ ...STRONG, novelty: 0.9 });
    expect(result.verdict).toBe('ESCALATE');
    expect(result.reason).toBe('HIGH_NOVELTY');
  });

  it('is UNCERTAIN when calibration, historical accuracy and replay stability are all unknown and no human has looked', () => {
    const result = computeTrustVerdict({ ...STRONG, model_calibration: null, model_historical_accuracy: null, replay_stability: null, human_validation: false });
    expect(result.verdict).toBe('UNCERTAIN');
    expect(result.reason).toBe('INSUFFICIENT_SIGNAL');
  });

  it('is not UNCERTAIN for the same missing signals once a human has validated the case', () => {
    const result = computeTrustVerdict({ ...STRONG, model_calibration: null, model_historical_accuracy: null, replay_stability: null, human_validation: true });
    expect(result.verdict).not.toBe('UNCERTAIN');
  });

  it(`is CONDITIONAL when replay_stability is below the floor (${TRUST_THRESHOLDS.replayStabilityFloor}) — the decision moved under a counterfactual`, () => {
    const result = computeTrustVerdict({ ...STRONG, replay_stability: 0.1 });
    expect(result.verdict).toBe('CONDITIONAL');
    expect(result.reason).toBe('REPLAY_FRAGILE');
  });

  it(`is CONDITIONAL when evidence_independence is below the floor (${TRUST_THRESHOLDS.evidenceIndependenceFloor})`, () => {
    const result = computeTrustVerdict({ ...STRONG, evidence_independence: 0.1 });
    expect(result.verdict).toBe('CONDITIONAL');
    expect(result.reason).toBe('LOW_INDEPENDENCE');
  });

  it('evaluates the most disqualifying reason first: a contradiction outranks a fragile replay', () => {
    const result = computeTrustVerdict({ ...STRONG, contradiction_count: 1, replay_stability: 0.1, human_validation: false });
    expect(result.verdict).toBe('BLOCKED');
    expect(result.reason).toBe('UNRESOLVED_CONTRADICTION');
  });
});
