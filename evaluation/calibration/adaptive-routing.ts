/**
 * Adaptive routing (System-1 directive step 9, the last slice in the directive's plan): proposes
 * a new `SYSTEM1_THRESHOLDS.uncertaintyCeiling` from real `{uncertainty, correct}` samples, using
 * Youden's J statistic - a standard, named technique for picking an operating threshold on a
 * monotonic binary classifier (used broadly in ROC analysis / diagnostic testing), not an ad-hoc
 * formula invented for this file. It cannot reuse `evaluation/calibration/pipeline.ts`'s own
 * `{confidence, correct}` samples: `contracts/schemas.ts` explicitly documents `ModelResult.
 * uncertainty` as "never a arithmetic negation of `confidence`" (it is normalized Shannon entropy
 * of `probabilities`, a different statistic on a different scale), so this module needs its own
 * real samples keyed on `uncertainty`, not a conversion invented on top of calibration's.
 *
 * This module only PROPOSES a ceiling; it never writes back into `SYSTEM1_THRESHOLDS` itself.
 * Mutating a shared, code-level constant at runtime from a statistical proposal, with no human
 * step in between, is exactly the kind of unreviewed repo mutation the adapters convention (§0:
 * "no repo is written to without a human import step") already forbids one layer up - adopting a
 * proposed threshold change should be a deliberate act (an `IMPROVEMENT_PROPOSED` ledger event,
 * once `core/` has a real Improvement lifecycle - not yet built; `LEARNING_MODEL.md` already scopes
 * that to Phase 17, well past where this repo is today), not something a pure function does
 * silently on every import.
 *
 * There is no real call site for this today, for the same reason `runSystem1Calibration()` has
 * none: this repo has zero real `Outcome` records anywhere, so there are zero real
 * `{uncertainty, correct}` pairs to feed it - a sample needs a real `ModelResult.uncertainty` AND a
 * real, human-confirmed `Outcome.matches_prediction` for the same case. `core/outcome-engine.ts`
 * can now record the second half, but nothing in this repo has produced one yet.
 */
import { SYSTEM1_THRESHOLDS } from '../../core/arbitration-engine';
import { CALIBRATION_THRESHOLDS } from './pipeline';

export type AdaptiveRoutingSample = {
  uncertainty: number;
  correct: boolean;
};

export type AdaptiveRoutingResult =
  | { status: 'INSUFFICIENT_DATA'; sampleSize: number; minimumRequired: number }
  | { status: 'PROPOSED'; sampleSize: number; currentCeiling: number; proposedCeiling: number; youdenJ: number };

/**
 * Youden's J = sensitivity + specificity - 1, maximized over every distinct `uncertainty` value
 * present in the samples (the only candidates that can actually change which samples fall on each
 * side of the ceiling). "Accept" means `uncertainty <= candidate`; sensitivity is the fraction of
 * genuinely correct outcomes an accept-at-this-ceiling policy would have accepted, specificity is
 * the fraction of genuinely incorrect outcomes it would have rejected instead. Ties keep the
 * lowest-uncertainty candidate (samples sorted ascending, `>` not `>=` when replacing best) - a
 * tighter ceiling is the more conservative real proposal when two are equally well supported.
 */
function bestCeilingByYoudenJ(samples: AdaptiveRoutingSample[]): { ceiling: number; j: number } {
  const totalCorrect = samples.filter((s) => s.correct).length;
  const totalIncorrect = samples.length - totalCorrect;
  const candidates = [...new Set(samples.map((s) => s.uncertainty))].sort((a, b) => a - b);

  let best = { ceiling: candidates[0] ?? 0, j: -Infinity };
  for (const candidate of candidates) {
    const accepted = samples.filter((s) => s.uncertainty <= candidate);
    const acceptedCorrect = accepted.filter((s) => s.correct).length;
    const rejectedIncorrect = totalIncorrect - (accepted.length - acceptedCorrect);
    const sensitivity = totalCorrect > 0 ? acceptedCorrect / totalCorrect : 0;
    const specificity = totalIncorrect > 0 ? rejectedIncorrect / totalIncorrect : 0;
    const j = sensitivity + specificity - 1;
    if (j > best.j) best = { ceiling: candidate, j };
  }
  return best;
}

export function proposeUncertaintyCeiling(
  samples: AdaptiveRoutingSample[],
  currentCeiling: number,
  minimumSampleSize: number = CALIBRATION_THRESHOLDS.minimumSampleSize,
): AdaptiveRoutingResult {
  if (samples.length < minimumSampleSize) {
    return { status: 'INSUFFICIENT_DATA', sampleSize: samples.length, minimumRequired: minimumSampleSize };
  }
  const { ceiling, j } = bestCeilingByYoudenJ(samples);
  return { status: 'PROPOSED', sampleSize: samples.length, currentCeiling, proposedCeiling: ceiling, youdenJ: j };
}

/**
 * The real call site, today: this repo has zero real `{uncertainty, correct}` pairs (see this
 * file's top comment), so calling this with nothing produces the honest `INSUFFICIENT_DATA`
 * result, exactly like `runSystem1Calibration()`.
 */
export function proposeSystem1ThresholdAdaptation(
  samples: AdaptiveRoutingSample[] = [],
  currentCeiling: number = SYSTEM1_THRESHOLDS.uncertaintyCeiling,
): AdaptiveRoutingResult {
  return proposeUncertaintyCeiling(samples, currentCeiling);
}
