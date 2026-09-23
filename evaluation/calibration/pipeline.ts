/**
 * Calibration pipeline (System-1 directive step 5, spec §8/§14): the pure math a real calibration
 * check needs - a Brier score and a reliability-diagram bucketing over `{confidence, correct}`
 * samples - built and tested now, with an honest `INSUFFICIENT_DATA` gate for the fact this repo
 * has zero real samples to feed it.
 *
 * There is no real call site for this today. MESH's own `Outcome` type (`contracts/schemas.ts`,
 * section 11) already has the field a calibration check would need (`matches_prediction`), but
 * nothing anywhere in this repo ever constructs a real `Outcome` record (checked directly: a
 * search for `matches_prediction`/`actual_result` outside `contracts/schemas.ts` and test files
 * finds nothing) - not even the two golden cases carry one. Building a bridge from `ModelResult`
 * to `Outcome` today would mean inventing an assumption spec §8/§14 does not state (whether one
 * case's `Outcome.matches_prediction` describes each individual System-1 model's own correctness,
 * or only the case's final Decision) - exactly the kind of speculative code `docs/MESH_ARCHITECTURE.md`
 * already declines to write for the learning ledger's validation machinery, for the same reason:
 * there is nothing real yet to validate that assumption against. This module stops at the honest
 * boundary: the math is real and tested against a clearly-synthetic verification dataset, and the
 * gate that would keep it from lying about today's real (zero) sample count is real too.
 */

export type CalibrationSample = {
  confidence: number;
  correct: boolean;
};

/**
 * `ASSUMED` scaffolding, exactly like `TRUST_THRESHOLDS` and `SYSTEM1_THRESHOLDS`: no
 * MESH-measured calibration study exists to derive a real minimum from. 30 is the textbook rule of
 * thumb for a reliability-diagram bucket to mean anything (roughly 3 samples per bucket across 10
 * buckets) - a placeholder floor, not a fitted value, and it must be revisited once real outcomes
 * accumulate.
 */
export const CALIBRATION_THRESHOLDS = {
  kind: 'PARAMETER' as const,
  scope: 'calibration pipeline minimum sample size',
  calibratedBy: 'ASSUMED. No MESH-measured historical outcomes exist yet (spec §8/§14 require real '
    + 'cases first) — this is a textbook rule-of-thumb floor, not a fitted value, and must be '
    + 'revisited once real outcomes accumulate.',
  minimumSampleSize: 30,
  bucketCount: 10,
};

export type CalibrationBucket = {
  rangeLow: number;
  rangeHigh: number;
  sampleCount: number;
  meanConfidence: number | null;
  empiricalAccuracy: number | null;
};

export type CalibrationResult =
  | { status: 'INSUFFICIENT_DATA'; sampleSize: number; minimumRequired: number }
  | { status: 'COMPUTED'; sampleSize: number; brierScore: number; buckets: CalibrationBucket[] };

function buildBuckets(samples: CalibrationSample[], bucketCount: number): CalibrationBucket[] {
  const buckets: CalibrationBucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const rangeLow = i / bucketCount;
    const rangeHigh = (i + 1) / bucketCount;
    const inBucket = samples.filter((s) => (
      i === bucketCount - 1 ? s.confidence >= rangeLow && s.confidence <= rangeHigh : s.confidence >= rangeLow && s.confidence < rangeHigh
    ));
    const sampleCount = inBucket.length;
    const meanConfidence = sampleCount > 0 ? inBucket.reduce((sum, s) => sum + s.confidence, 0) / sampleCount : null;
    const empiricalAccuracy = sampleCount > 0 ? inBucket.filter((s) => s.correct).length / sampleCount : null;
    buckets.push({ rangeLow, rangeHigh, sampleCount, meanConfidence, empiricalAccuracy });
  }
  return buckets;
}

/**
 * Brier score: mean squared error between each sample's stated `confidence` and the binary
 * outcome (1 if `correct`, 0 otherwise) - lower is better calibrated, 0 is perfect, 0.25 is what a
 * model that always says "0.5" scores against a 50/50 real distribution.
 */
function brierScore(samples: CalibrationSample[]): number {
  const sumSquaredError = samples.reduce((sum, s) => sum + (s.confidence - (s.correct ? 1 : 0)) ** 2, 0);
  return sumSquaredError / samples.length;
}

export function computeCalibration(
  samples: CalibrationSample[],
  thresholds: { minimumSampleSize: number; bucketCount: number } = CALIBRATION_THRESHOLDS,
): CalibrationResult {
  if (samples.length < thresholds.minimumSampleSize) {
    return { status: 'INSUFFICIENT_DATA', sampleSize: samples.length, minimumRequired: thresholds.minimumSampleSize };
  }
  return {
    status: 'COMPUTED',
    sampleSize: samples.length,
    brierScore: brierScore(samples),
    buckets: buildBuckets(samples, thresholds.bucketCount),
  };
}

/**
 * The real call site, today: this repo has zero real samples (see this file's top comment), so
 * calling this with nothing produces the honest `INSUFFICIENT_DATA` result rather than silently
 * having no caller at all. Once a real bridge from `ModelResult` + `Outcome` to
 * `CalibrationSample[]` is designed (needs a spec answer to the per-model-vs-per-case question
 * above first), that bridge's real output replaces the empty array here - this function's shape
 * does not need to change when that happens.
 */
export function runSystem1Calibration(samples: CalibrationSample[] = []): CalibrationResult {
  return computeCalibration(samples);
}
