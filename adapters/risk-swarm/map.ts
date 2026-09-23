/**
 * Translation from risk-swarm's real `CouncilResult` shape into MESH contracts (spec §11, §35).
 * No fetch happens here (see `types.ts` for why) — every function takes an already-produced
 * `CouncilResult` and an explicit `provenance` describing how the caller actually got it, because
 * this module has no way to know that on its own.
 */
import type { ModelResult, Disagreement, ProvenanceSource } from '../../contracts/schemas';
import type { CouncilResult, ReasoningAgent } from './types';

export interface MapArgs {
  caseId: string;
  observedAt: string;
  provenanceSource: ProvenanceSource;
  /** Commit hash, run id, or fixture filename this CouncilResult can be traced back to. */
  upstreamRef: string | null;
}

/**
 * One `ModelResult` per agent, degraded or not — a `ModelResult` only claims "this model produced
 * this output", never independence, so a degraded (fallback) entry is still a real record of what
 * ran; the degraded_reason is preserved in `provenance.note` rather than silently dropped.
 */
export function councilPositionsToModelResults(result: CouncilResult, args: MapArgs): ModelResult[] {
  return (Object.entries(result.positions) as Array<[ReasoningAgent, CouncilResult['positions'][ReasoningAgent]]>).map(([agent, entry]) => ({
    id: `risk-swarm-modelresult-${args.caseId}-${agent}`,
    schema_version: '1.0',
    created_at: args.observedAt,
    source: 'risk-swarm-adapter',
    provenance: {
      source: args.provenanceSource,
      system: 'risk-swarm-council',
      retrieved_at: args.observedAt,
      upstream_ref: args.upstreamRef,
      note: entry.degraded ? `degraded fallback (${entry.degraded_reason ?? 'no reason given'}), provider=${entry.provider}` : `independent live position, provider=${entry.provider}`,
    },
    status: 'RECORDED',
    case_id: args.caseId,
    model_id: agent,
    checkpoint: entry.provider,
    decision: entry.position.stance,
    probabilities: null,
    confidence: entry.position.confidence,
    /** risk-swarm's council has no probability distribution to compute entropy from. */
    uncertainty: null,
    /** risk-swarm agents aren't typed to Laya's choice/score/noul taxonomy. */
    primitive: null,
    latency_ms: entry.ms,
    raw_output: entry as unknown as Record<string, unknown>,
  }));
}

export type DisagreementMapResult =
  | { ok: true; disagreement: Disagreement }
  | { ok: false; reason: string };

/**
 * §35: a disagreement is a signal, never averaged away. `model_ids`/`positions` here are restricted
 * to non-degraded entries only — risk-swarm's own `DisagreementAssessment` doc comment is explicit
 * that "a degraded (fallback) position does not count as an independent opinion", and MESH's
 * `Disagreement` contract requires >=2 real positions, so this fails closed rather than counting a
 * fallback as if it were independent.
 */
export function councilToDisagreement(result: CouncilResult, args: MapArgs): DisagreementMapResult {
  const independentEntries = (Object.entries(result.positions) as Array<[ReasoningAgent, CouncilResult['positions'][ReasoningAgent]]>).filter(([, entry]) => !entry.degraded);

  if (independentEntries.length < 2) {
    return {
      ok: false,
      reason: `only ${independentEntries.length} independent (non-degraded) position(s); MESH's Disagreement contract requires at least 2, and risk-swarm's own DisagreementAssessment doesn't count a degraded fallback as independent.`,
    };
  }

  const resolved = result.verdict.verdict.verdict_type !== 'UNRESOLVED';

  return {
    ok: true,
    disagreement: {
      id: `risk-swarm-disagreement-${args.caseId}`,
      schema_version: '1.0',
      created_at: args.observedAt,
      source: 'risk-swarm-adapter',
      provenance: {
        source: args.provenanceSource,
        system: 'risk-swarm-council',
        retrieved_at: args.observedAt,
        upstream_ref: args.upstreamRef,
        note: `risk-swarm agreement=${result.disagreement.agreement}, verdict_type=${result.verdict.verdict.verdict_type}`,
      },
      status: resolved ? 'RESOLVED' : 'OPEN',
      case_id: args.caseId,
      model_ids: independentEntries.map(([agent]) => agent),
      positions: independentEntries.map(([agent, entry]) => ({ model_id: agent, stance: entry.position.stance, confidence: entry.position.confidence })),
      resolution: resolved ? result.verdict.verdict.answer : null,
    },
  };
}

/**
 * A scale from risk-swarm's own 4-value `agreement` label to a `TrustDrivers.model_agreement` number
 * (spec §34), so a council result can feed the trust engine. `ASSUMED`, same as every other threshold
 * in `core/trust-engine.ts`: no MESH-measured outcome data exists yet to fit this to, so it's a
 * placeholder ordering (strong_consensus > majority > split > inconclusive), not a calibrated value.
 */
export const AGREEMENT_TO_MODEL_AGREEMENT_SCORE: Record<CouncilResult['disagreement']['agreement'], number> = {
  strong_consensus: 0.95,
  majority: 0.7,
  split: 0.35,
  inconclusive: 0.1,
};

export function agreementToModelAgreementScore(agreement: CouncilResult['disagreement']['agreement']): number {
  return AGREEMENT_TO_MODEL_AGREEMENT_SCORE[agreement];
}
