/**
 * Pure comparison logic for the System-1 Arena (directive step 4): given the independent
 * `ModelResult`s multiple models produced for the *same* case, decide whether they agree, and if
 * not, build a real `Disagreement` (spec section 35) rather than averaging or majority-voting the
 * difference away. Mirrors the shape of `adapters/risk-swarm/map.ts`'s `councilToDisagreement`
 * (same idea: positions + resolution), but generalized over any set of `ModelResult`s instead of
 * risk-swarm's own `CouncilResult` - kept as its own function rather than importing risk-swarm's,
 * since that one is tied to risk-swarm's domain type and this one is not.
 */
import type { ModelResult, Disagreement } from '../../contracts/schemas';

export type ArenaComparison =
  | { agreement: true; model_agreement_score: number }
  | { agreement: false; model_agreement_score: number; disagreement: Disagreement };

/**
 * `model_agreement_score` is `ASSUMED` scaffolding, exactly like risk-swarm's own
 * `AGREEMENT_TO_MODEL_AGREEMENT_SCORE` and every threshold in `core/trust-engine.ts`: no
 * MESH-measured outcome data exists yet to calibrate this against, so it is a placeholder
 * ordering (full agreement scores high, any disagreement scores low), not a fitted value.
 */
const FULL_AGREEMENT_SCORE = 0.9;
const DISAGREEMENT_SCORE = 0.15;

export function compareModelResults(
  results: ModelResult[],
  args: { caseId: string; observedAt: string },
): ArenaComparison {
  if (results.length < 2) {
    throw new Error('compareModelResults needs at least 2 independent ModelResults to compare - the whole point of the arena is that no single model ever compares against itself.');
  }

  const decisions = new Set(results.map((r) => r.decision));
  if (decisions.size === 1) {
    return { agreement: true, model_agreement_score: FULL_AGREEMENT_SCORE };
  }

  const disagreement: Disagreement = {
    id: `arena-disagreement-${args.caseId}-${args.observedAt}`,
    schema_version: '1.0',
    created_at: args.observedAt,
    source: 'system1-arena',
    provenance: {
      source: 'LIVE',
      system: 'system1-arena',
      retrieved_at: args.observedAt,
      upstream_ref: null,
      note: `${results.length} independent models answered the same case; ${decisions.size} distinct decisions - a real signal, not averaged away (spec section 35).`,
    },
    status: 'OPEN',
    case_id: args.caseId,
    model_ids: results.map((r) => r.model_id),
    positions: results.map((r) => ({ model_id: r.model_id, stance: r.decision, confidence: r.confidence })),
    resolution: null,
  };

  return { agreement: false, model_agreement_score: DISAGREEMENT_SCORE, disagreement };
}
