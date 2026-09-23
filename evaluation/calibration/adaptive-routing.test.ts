import { describe, expect, it } from 'bun:test';
import { proposeUncertaintyCeiling, proposeSystem1ThresholdAdaptation, type AdaptiveRoutingSample } from './adaptive-routing';
import { CALIBRATION_THRESHOLDS } from './pipeline';
import { SYSTEM1_THRESHOLDS } from '../../core/arbitration-engine';

describe('proposeUncertaintyCeiling', () => {
  it('fails closed with INSUFFICIENT_DATA below the minimum sample size, using the default ASSUMED threshold', () => {
    const samples: AdaptiveRoutingSample[] = Array.from({ length: CALIBRATION_THRESHOLDS.minimumSampleSize - 1 }, () => ({ uncertainty: 0.5, correct: true }));
    const result = proposeUncertaintyCeiling(samples, SYSTEM1_THRESHOLDS.uncertaintyCeiling);
    expect(result.status).toBe('INSUFFICIENT_DATA');
    if (result.status !== 'INSUFFICIENT_DATA') throw new Error('unreachable');
    expect(result.sampleSize).toBe(CALIBRATION_THRESHOLDS.minimumSampleSize - 1);
    expect(result.minimumRequired).toBe(CALIBRATION_THRESHOLDS.minimumSampleSize);
  });

  it("picks the exact boundary ceiling on a perfectly-separable synthetic dataset (Youden's J = 1)", () => {
    // Hand-verified: every correct sample has uncertainty <= 0.3, every incorrect one has uncertainty >= 0.6.
    // Candidate 0.3 accepts exactly the 3 correct samples and rejects all 3 incorrect ones: sensitivity=1, specificity=1, J=1.
    const samples: AdaptiveRoutingSample[] = [
      { uncertainty: 0.1, correct: true },
      { uncertainty: 0.2, correct: true },
      { uncertainty: 0.3, correct: true },
      { uncertainty: 0.6, correct: false },
      { uncertainty: 0.7, correct: false },
      { uncertainty: 0.8, correct: false },
    ];
    const result = proposeUncertaintyCeiling(samples, 0.7, 0);
    expect(result.status).toBe('PROPOSED');
    if (result.status !== 'PROPOSED') throw new Error('unreachable');
    expect(result.proposedCeiling).toBeCloseTo(0.3, 10);
    expect(result.youdenJ).toBeCloseTo(1, 10);
    expect(result.currentCeiling).toBe(0.7);
  });

  it('picks the best-supported ceiling on overlapping synthetic data, hand-verified against the tied lower candidate', () => {
    // Hand-verified: candidates 0.2 and 0.5 both score J=0.5 (sensitivity=0.5,specificity=1 and
    // sensitivity=1,specificity=0.5 respectively); 0.4 and 0.9 both score J=0. Ties keep the
    // lower candidate, so 0.2 wins over 0.5.
    const samples: AdaptiveRoutingSample[] = [
      { uncertainty: 0.2, correct: true },
      { uncertainty: 0.4, correct: false },
      { uncertainty: 0.5, correct: true },
      { uncertainty: 0.9, correct: false },
    ];
    const result = proposeUncertaintyCeiling(samples, 0.7, 0);
    expect(result.status).toBe('PROPOSED');
    if (result.status !== 'PROPOSED') throw new Error('unreachable');
    expect(result.proposedCeiling).toBeCloseTo(0.2, 10);
    expect(result.youdenJ).toBeCloseTo(0.5, 10);
  });

  it('never mutates SYSTEM1_THRESHOLDS itself - this is a proposal, never an auto-apply', () => {
    const before = SYSTEM1_THRESHOLDS.uncertaintyCeiling;
    const samples: AdaptiveRoutingSample[] = [
      { uncertainty: 0.1, correct: true },
      { uncertainty: 0.9, correct: false },
    ];
    proposeUncertaintyCeiling(samples, SYSTEM1_THRESHOLDS.uncertaintyCeiling, 0);
    expect(SYSTEM1_THRESHOLDS.uncertaintyCeiling).toBe(before);
  });
});

describe('proposeSystem1ThresholdAdaptation', () => {
  it("returns INSUFFICIENT_DATA with sampleSize 0 when called with no real samples - this repo's actual state today, not a fabricated placeholder", () => {
    const result = proposeSystem1ThresholdAdaptation();
    expect(result.status).toBe('INSUFFICIENT_DATA');
    if (result.status !== 'INSUFFICIENT_DATA') throw new Error('unreachable');
    expect(result.sampleSize).toBe(0);
    expect(result.minimumRequired).toBe(CALIBRATION_THRESHOLDS.minimumSampleSize);
  });
});
