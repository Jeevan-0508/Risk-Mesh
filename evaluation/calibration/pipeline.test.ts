import { describe, expect, it } from 'bun:test';
import { computeCalibration, runSystem1Calibration, CALIBRATION_THRESHOLDS, type CalibrationSample } from './pipeline';

describe('computeCalibration', () => {
  it('fails closed with INSUFFICIENT_DATA below the minimum sample size, using the default ASSUMED threshold', () => {
    const samples: CalibrationSample[] = Array.from({ length: CALIBRATION_THRESHOLDS.minimumSampleSize - 1 }, () => ({ confidence: 0.5, correct: true }));
    const result = computeCalibration(samples);
    expect(result.status).toBe('INSUFFICIENT_DATA');
    if (result.status !== 'INSUFFICIENT_DATA') throw new Error('unreachable');
    expect(result.sampleSize).toBe(CALIBRATION_THRESHOLDS.minimumSampleSize - 1);
    expect(result.minimumRequired).toBe(CALIBRATION_THRESHOLDS.minimumSampleSize);
  });

  it('computes once the sample size meets the minimum, using the default ASSUMED threshold', () => {
    const samples: CalibrationSample[] = Array.from({ length: CALIBRATION_THRESHOLDS.minimumSampleSize }, () => ({ confidence: 0.5, correct: true }));
    const result = computeCalibration(samples);
    expect(result.status).toBe('COMPUTED');
    if (result.status !== 'COMPUTED') throw new Error('unreachable');
    expect(result.sampleSize).toBe(CALIBRATION_THRESHOLDS.minimumSampleSize);
  });

  it('computes a real Brier score on a small, clearly-synthetic verification dataset (not MESH data)', () => {
    // Hand-picked so the arithmetic is checkable by hand: errors are 0, 0, 1, 1 -> mean 0.5.
    const samples: CalibrationSample[] = [
      { confidence: 1.0, correct: true },
      { confidence: 0.0, correct: false },
      { confidence: 1.0, correct: false },
      { confidence: 0.0, correct: true },
    ];
    const result = computeCalibration(samples, { minimumSampleSize: 0, bucketCount: 10 });
    expect(result.status).toBe('COMPUTED');
    if (result.status !== 'COMPUTED') throw new Error('unreachable');
    expect(result.brierScore).toBeCloseTo(0.5, 10);
  });

  it('scores a perfectly-calibrated synthetic dataset near 0 and an overconfident one higher - the math discriminates, not just returns a constant', () => {
    // Perfectly calibrated: 10 samples at confidence 0.9, exactly 9 of 10 correct (matches exactly).
    const calibrated: CalibrationSample[] = [
      ...Array.from({ length: 9 }, () => ({ confidence: 0.9, correct: true })),
      { confidence: 0.9, correct: false },
    ];
    // Overconfident: same stated confidence (0.9), but only 1 of 10 actually correct.
    const overconfident: CalibrationSample[] = [
      { confidence: 0.9, correct: true },
      ...Array.from({ length: 9 }, () => ({ confidence: 0.9, correct: false })),
    ];
    const calibratedResult = computeCalibration(calibrated, { minimumSampleSize: 0, bucketCount: 10 });
    const overconfidentResult = computeCalibration(overconfident, { minimumSampleSize: 0, bucketCount: 10 });
    if (calibratedResult.status !== 'COMPUTED' || overconfidentResult.status !== 'COMPUTED') throw new Error('unreachable');
    expect(calibratedResult.brierScore).toBeLessThan(overconfidentResult.brierScore);
  });

  it('buckets samples by confidence range, with the top bucket including confidence=1.0 at its inclusive upper edge', () => {
    const samples: CalibrationSample[] = [
      { confidence: 0.05, correct: true },
      { confidence: 0.95, correct: true },
      { confidence: 1.0, correct: false },
    ];
    const result = computeCalibration(samples, { minimumSampleSize: 0, bucketCount: 10 });
    if (result.status !== 'COMPUTED') throw new Error('unreachable');
    expect(result.buckets).toHaveLength(10);
    const firstBucket = result.buckets[0];
    const lastBucket = result.buckets[9];
    if (!firstBucket || !lastBucket) throw new Error('unreachable');
    expect(firstBucket.sampleCount).toBe(1); // confidence=0.05 -> bucket [0, 0.1)
    expect(lastBucket.sampleCount).toBe(2); // confidence=0.95 and 1.0 -> bucket [0.9, 1.0]
    expect(lastBucket.empiricalAccuracy).toBeCloseTo(0.5, 10);
  });
});

describe('runSystem1Calibration', () => {
  it('returns INSUFFICIENT_DATA with sampleSize 0 when called with no real samples - this repo\'s actual state today, not a fabricated placeholder', () => {
    const result = runSystem1Calibration();
    expect(result.status).toBe('INSUFFICIENT_DATA');
    if (result.status !== 'INSUFFICIENT_DATA') throw new Error('unreachable');
    expect(result.sampleSize).toBe(0);
    expect(result.minimumRequired).toBe(CALIBRATION_THRESHOLDS.minimumSampleSize);
  });
});
