/**
 * Deterministic trust scoring (spec §34): every named driver in `TrustDrivers` is consulted
 * explicitly, in a declared order, and the verdict always comes with the reason that produced it
 * (never a bare label, same convention used throughout this repo's adapters). No MESH-measured
 * historical outcomes exist yet anywhere in this ecosystem (confirmed in Phase 0's audit), so every
 * threshold below is declared `ASSUMED`, exactly like fraud-watch's own `DISCOVERY_THRESHOLDS` are
 * honest about being unfitted placeholders rather than calibrated values.
 */
import type { TrustDrivers, TrustVerdict } from '../contracts/schemas';

export const TRUST_THRESHOLDS = {
  kind: 'PARAMETER' as const,
  scope: 'trust-engine verdict boundaries',
  calibratedBy: 'ASSUMED. No MESH-measured historical outcomes exist yet (spec §34, §49 require real ' +
    'cases first) — every boundary below is placeholder scaffolding, not a fitted value, and must be ' +
    'revisited once real outcomes accumulate.',
  evidenceQualityFloor: 0.4,
  modelAgreementFloor: 0.5,
  noveltyEscalateCeiling: 0.75,
  replayStabilityFloor: 0.5,
  evidenceIndependenceFloor: 0.5,
};

export const TRUST_REASONS = {
  UNRESOLVED_CONTRADICTION: {
    verdict: 'BLOCKED' as TrustVerdict,
    note: 'evidence contains at least one unresolved contradiction and no human has validated past it.',
  },
  EVIDENCE_QUALITY_BELOW_FLOOR: {
    verdict: 'BLOCKED' as TrustVerdict,
    note: `evidence_quality is below ${TRUST_THRESHOLDS.evidenceQualityFloor}: too little substance to reason from, regardless of anything else.`,
  },
  MODEL_DISAGREEMENT: {
    verdict: 'ESCALATE' as TrustVerdict,
    note: `model_agreement is below ${TRUST_THRESHOLDS.modelAgreementFloor} — a disagreement, which spec §35 says is a signal, never averaged away.`,
  },
  HIGH_NOVELTY: {
    verdict: 'ESCALATE' as TrustVerdict,
    note: `novelty is above ${TRUST_THRESHOLDS.noveltyEscalateCeiling}: nothing comparable exists yet, so a human or SWARM should look before MESH decides alone.`,
  },
  INSUFFICIENT_SIGNAL: {
    verdict: 'UNCERTAIN' as TrustVerdict,
    note: 'model_calibration, model_historical_accuracy and replay_stability are all null and no human has validated this case — none of the corroborating signals exist yet.',
  },
  REPLAY_FRAGILE: {
    verdict: 'CONDITIONAL' as TrustVerdict,
    note: `replay_stability is below ${TRUST_THRESHOLDS.replayStabilityFloor}: the decision moved under a counterfactual mutation, so it is trusted only conditionally.`,
  },
  LOW_INDEPENDENCE: {
    verdict: 'CONDITIONAL' as TrustVerdict,
    note: `evidence_independence is below ${TRUST_THRESHOLDS.evidenceIndependenceFloor}: the evidence corroborates itself from correlated sources rather than independent ones.`,
  },
  ALL_DRIVERS_STRONG: {
    verdict: 'TRUSTED' as TrustVerdict,
    note: 'no named driver fell below its declared floor and no disagreement, contradiction, or fragility was found.',
  },
} as const;
export type TrustReason = keyof typeof TRUST_REASONS;

/** Every TrustVerdict value must be reachable by at least one declared reason, or a verdict exists that no branch below can ever produce. */
function assertEveryVerdictReachable(): void {
  const declaredVerdicts = new Set(Object.values(TRUST_REASONS).map((r) => r.verdict));
  const allVerdicts: TrustVerdict[] = ['TRUSTED', 'CONDITIONAL', 'UNCERTAIN', 'ESCALATE', 'BLOCKED'];
  const unreachable = allVerdicts.filter((v) => !declaredVerdicts.has(v));
  if (unreachable.length > 0) {
    throw new Error(`trust-engine: verdict(s) ${unreachable.join(', ')} have no declared reason and can never be issued`);
  }
}
assertEveryVerdictReachable();

export interface TrustAssessment {
  verdict: TrustVerdict;
  reason: TrustReason;
  reasonNote: string;
}

/**
 * First matching branch wins, most disqualifying first — the same "declared order, not implicit
 * priority" structure as fraud-watch's `classifyDiscoveryDetail`. `contradiction_count` blocks
 * outright unless a human has already validated past it (§46: human decision is authoritative);
 * `evidence_quality` blocks regardless of human_validation, because a data-quality floor is not
 * something a human sign-off retroactively fixes.
 */
export function computeTrustVerdict(drivers: TrustDrivers): TrustAssessment {
  if (drivers.contradiction_count > 0 && !drivers.human_validation) {
    return { verdict: TRUST_REASONS.UNRESOLVED_CONTRADICTION.verdict, reason: 'UNRESOLVED_CONTRADICTION', reasonNote: TRUST_REASONS.UNRESOLVED_CONTRADICTION.note };
  }
  if (drivers.evidence_quality < TRUST_THRESHOLDS.evidenceQualityFloor) {
    return { verdict: TRUST_REASONS.EVIDENCE_QUALITY_BELOW_FLOOR.verdict, reason: 'EVIDENCE_QUALITY_BELOW_FLOOR', reasonNote: TRUST_REASONS.EVIDENCE_QUALITY_BELOW_FLOOR.note };
  }
  if (drivers.model_agreement !== null && drivers.model_agreement < TRUST_THRESHOLDS.modelAgreementFloor) {
    return { verdict: TRUST_REASONS.MODEL_DISAGREEMENT.verdict, reason: 'MODEL_DISAGREEMENT', reasonNote: TRUST_REASONS.MODEL_DISAGREEMENT.note };
  }
  if (drivers.novelty > TRUST_THRESHOLDS.noveltyEscalateCeiling) {
    return { verdict: TRUST_REASONS.HIGH_NOVELTY.verdict, reason: 'HIGH_NOVELTY', reasonNote: TRUST_REASONS.HIGH_NOVELTY.note };
  }
  if (drivers.model_calibration === null && drivers.model_historical_accuracy === null && drivers.replay_stability === null && !drivers.human_validation) {
    return { verdict: TRUST_REASONS.INSUFFICIENT_SIGNAL.verdict, reason: 'INSUFFICIENT_SIGNAL', reasonNote: TRUST_REASONS.INSUFFICIENT_SIGNAL.note };
  }
  if (drivers.replay_stability !== null && drivers.replay_stability < TRUST_THRESHOLDS.replayStabilityFloor) {
    return { verdict: TRUST_REASONS.REPLAY_FRAGILE.verdict, reason: 'REPLAY_FRAGILE', reasonNote: TRUST_REASONS.REPLAY_FRAGILE.note };
  }
  if (drivers.evidence_independence < TRUST_THRESHOLDS.evidenceIndependenceFloor) {
    return { verdict: TRUST_REASONS.LOW_INDEPENDENCE.verdict, reason: 'LOW_INDEPENDENCE', reasonNote: TRUST_REASONS.LOW_INDEPENDENCE.note };
  }
  return { verdict: TRUST_REASONS.ALL_DRIVERS_STRONG.verdict, reason: 'ALL_DRIVERS_STRONG', reasonNote: TRUST_REASONS.ALL_DRIVERS_STRONG.note };
}
