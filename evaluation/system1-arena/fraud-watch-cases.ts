/**
 * Fraud Watch integration (System-1 directive step 6): wires a real fraud-watch-sourced `Behavior`
 * (`adapters/fraud-watch/`, real on-disk simulation state, Phase 5) into the System-1 Arena and
 * `decideSystem1Action()` - the first real call site for the shadow routing recommendation added
 * in the previous slice. Per spec §16, `Behavior.simulated` is always `true` for a fraud-watch
 * source; this module never exposes fraud-watch's own pre-computed judgment about the same
 * signals (`confidence`/`confidenceBand`/`noveltyScore`/`investigation` - see
 * `adapters/fraud-watch/client.ts`'s `FraudWatchMoRecord` type) to Laya, only the same
 * already-tested `description` text a human reviewer would see. There is no fraud/no-fraud
 * ground-truth label anywhere in a fraud-watch MO record for this to leak even by accident -
 * checked directly against that type, not assumed.
 */
import { decideSystem1Action, type System1Context, type System1Input } from '../../core/arbitration-engine';
import type { ArbitrationDecision } from '../../core/arbitration-engine';
import { runSystem1Arena, type ArenaRunResult } from './run';
import type { ArenaComparison } from './compare';
import type { CallModelDeps } from '../../adapters/model-registry/client';
import type { LayaQuestion } from '../../adapters/model-registry/laya-runtime';
import type { Behavior, ModelResult } from '../../contracts/schemas';

/**
 * A real, captured question (see `adapters/model-registry/__fixtures__/laya-typed-fraud-watch-mo0001-call.json`),
 * not restated from the earlier POD-photo scenario's `fabrication_call` - MOs are a different real
 * question from a document-fabrication call.
 */
export const CARRIER_BEHAVIOR_QUESTION: LayaQuestion = {
  type: 'choice',
  instructions: "Given this carrier's flagged operational signals, does the underlying pattern look like normal operations, or does it show signs meriting closer fraud investigation?",
  criteria: {
    normal: 'The pattern of signals is consistent with normal carrier operations.',
    investigate: 'The pattern of signals shows signs meriting closer fraud investigation.',
    inconclusive: 'Not enough signal either way.',
  },
};

/**
 * Builds a Laya-callable state string from a real fraud-watch-sourced `Behavior` - `description`
 * only, plus one static framing sentence (not a new interpretation of the signal codes). See this
 * file's own top comment for exactly what is deliberately excluded and why.
 */
export function behaviorToLayaState(behavior: Behavior): string {
  return `${behavior.description}. This case comes from fraud-watch's simulated carrier-fraud `
    + 'environment (spec \u00a716): the signature lists which anomaly signal types fired for this '
    + 'carrier/driver/trailer combination. No fraud-watch investigation judgment or confidence '
    + 'score is included in this description - only the raw signal types and entity identifiers.';
}

/**
 * Translates the Arena's own `ArenaComparison` (evaluation-layer type) into `decideSystem1Action`'s
 * plain `contracts/schemas`-typed input - the seam the previous slice's docstring described but
 * did not yet have a real caller for.
 */
export function arenaComparisonToSystem1Input(results: ModelResult[], comparison: ArenaComparison): System1Input {
  return {
    results,
    modelAgreementScore: comparison.model_agreement_score,
    disagreement: comparison.agreement ? null : comparison.disagreement,
  };
}

export type FraudWatchSystem1Result =
  | { ok: true; arena: Extract<ArenaRunResult, { ok: true }>; system1Decision: ArbitrationDecision }
  | { ok: false; reason: string; arena: ArenaRunResult };

/**
 * End to end: a real fraud-watch `Behavior` -> a real Laya/Arena call -> a real shadow-mode
 * `decideSystem1Action` recommendation. `context` is required, not defaulted, so a caller cannot
 * accidentally forget it is choosing `swarmAvailable`/`jevAvailable`/`caseRisk` - every real call
 * site in this repo today passes the honest defaults (`false`/`false`/`'STANDARD'`), matching
 * every other adapter's own `ANY_CONTEXT`-style test convention.
 */
export async function evaluateBehaviorViaSystem1(
  behavior: Behavior,
  modelIds: string[],
  context: System1Context,
  deps?: CallModelDeps,
): Promise<FraudWatchSystem1Result> {
  const state = behaviorToLayaState(behavior);
  const arena = await runSystem1Arena(modelIds, { case_id: behavior.case_id ?? undefined, state, question: CARRIER_BEHAVIOR_QUESTION }, deps);
  if (!arena.ok) {
    return { ok: false, reason: arena.reason, arena };
  }
  const input = arenaComparisonToSystem1Input(arena.results, arena.comparison);
  const system1Decision = decideSystem1Action(input, context);
  return { ok: true, arena, system1Decision };
}
