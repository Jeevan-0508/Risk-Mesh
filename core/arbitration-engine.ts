/**
 * Deterministic arbitration (spec §12): turns a `TrustAssessment` plus what's actually available
 * right now (is SWARM connected, has replay already run, can more evidence plausibly be requested)
 * into one `ArbitrationAction`, always with a non-empty `rationale` — never a bare label. Per the
 * ecosystem audit, `swarmAvailable` is honestly `false` everywhere in this repo today (risk-swarm has
 * no live/snapshot adapter yet, see INTEGRATION_MATRIX.md); this function takes it as a parameter
 * rather than hard-coding that, so it stops needing an update the day that adapter ships.
 */
import type { ArbitrationAction, Disagreement, ModelResult } from '../contracts/schemas';
import type { TrustAssessment } from './trust-engine';

export interface ArbitrationContext {
  /** Is a risk-swarm council actually reachable to escalate to? Honestly `false` until that adapter exists. */
  swarmAvailable: boolean;
  /** Did the risk-replay adapter already run for this case (i.e. is `replay_stability` non-null)? */
  replayAlreadyRun: boolean;
  /** Is there a concrete, nameable evidence gap MESH could plausibly ask someone to fill? */
  moreEvidenceRequestable: boolean;
}

export interface ArbitrationDecision {
  action: ArbitrationAction;
  rationale: string[];
}

/**
 * Verdict-to-action is not 1:1 (5 TrustVerdict values, 7 ArbitrationAction values) — the extra
 * context above is exactly what disambiguates, e.g. two UNCERTAIN cases can honestly resolve to
 * different actions depending on whether a replay has already been tried.
 */
export function decideArbitrationAction(trust: TrustAssessment, context: ArbitrationContext): ArbitrationDecision {
  const rationale = [trust.reasonNote];

  switch (trust.verdict) {
    case 'BLOCKED':
      rationale.push('a BLOCKED trust verdict is never auto-rejected by MESH alone — a human must look.');
      return { action: 'HUMAN_REVIEW', rationale };

    case 'ESCALATE':
      if (context.swarmAvailable) {
        rationale.push('risk-swarm is reachable, so the disagreement/novelty goes to its council rather than a single human.');
        return { action: 'ESCALATE_TO_SWARM', rationale };
      }
      rationale.push('risk-swarm is not connected in this environment (§58: never fabricate a connection that does not exist), so this falls back to a human instead of failing silently.');
      return { action: 'HUMAN_REVIEW', rationale };

    case 'UNCERTAIN':
      if (!context.replayAlreadyRun) {
        rationale.push('the missing signal includes replay_stability, and no replay has been attempted yet for this case — requesting one is the most direct way to resolve part of the uncertainty.');
        return { action: 'REQUEST_REPLAY', rationale };
      }
      if (context.moreEvidenceRequestable) {
        rationale.push('replay has already run and a concrete evidence gap exists — requesting more evidence is the next honest step.');
        return { action: 'REQUEST_MORE_EVIDENCE', rationale };
      }
      rationale.push('replay has already run and no further evidence gap can be named — MESH abstains rather than guess at a verdict it cannot support.');
      return { action: 'ABSTAIN', rationale };

    case 'CONDITIONAL':
      if (trust.reason === 'LOW_INDEPENDENCE' && context.moreEvidenceRequestable) {
        rationale.push('the specific gap is independence, not quantity — requesting evidence from a different, uncorrelated source addresses it directly.');
        return { action: 'REQUEST_MORE_EVIDENCE', rationale };
      }
      rationale.push('the case is accepted, but only conditionally, given the caveat above.');
      return { action: 'CONDITIONAL', rationale };

    case 'TRUSTED':
      rationale.push('every named driver cleared its declared floor; nothing here overrides that.');
      return { action: 'ACCEPT', rationale };
  }
}


/**
 * System-1 routing (System-1 directive step 5): a sibling to `decideArbitrationAction`, not a
 * replacement — Laya's registry status is `SHADOW` (real inference, not yet authoritative for
 * routing per `docs/MODEL_ARENA.md`), so this function's output is a shadow-mode recommendation
 * for the Observatory to compare against MESH's real decisions, not something any case pipeline
 * calls today. Deliberately takes only `contracts/schemas` types, never `evaluation/system1-arena`'s
 * own types — `core/` imports nothing from `adapters/` or `evaluation/` anywhere in this repo
 * (verified by reading every `core/*.ts` import), and this keeps that direction intact. A caller
 * that has run the real Arena translates its `ArenaComparison` into `System1Input` at the call
 * site instead.
 */
export interface System1Context {
  /** Same honesty convention as `ArbitrationContext.swarmAvailable`: a parameter, not a hard-coded
   * assumption, so this stops needing an update the day it changes. */
  swarmAvailable: boolean;
  /** Honestly `false` everywhere in this repo today — Jev is `UNAVAILABLE` (see
   * `adapters/model-registry/registry.ts`) — taken as a parameter for the same reason. */
  jevAvailable: boolean;
  /** No real MESH case populates anything but `'STANDARD'` yet — this repo has no risk-scoring
   * field anywhere in `contracts/schemas.ts` (checked directly, not assumed). Taken as an explicit
   * parameter rather than invented from other fields, so a real source can plug in later without
   * this function changing. */
  caseRisk: 'STANDARD' | 'HIGH';
}

export interface System1Input {
  /** The real `ModelResult`s produced for this case — 0 (nothing to go on), 1 (a single Laya
   * checkpoint answered alone), or 2+ (compared by the Arena; see `modelAgreementScore` below). */
  results: ModelResult[];
  /** Mirrors `TrustDrivers.model_agreement`'s own scale (0-1) and meaning — `null` when fewer than
   * 2 results exist, since there is nothing to agree or disagree with yet. */
  modelAgreementScore: number | null;
  /** Non-null exactly when `modelAgreementScore` reflects a real disagreement, matching
   * `evaluation/system1-arena/compare.ts`'s own `ArenaComparison` shape one level up. */
  disagreement: Disagreement | null;
}

/**
 * `ASSUMED` scaffolding, exactly like `TRUST_THRESHOLDS` — no MESH-measured outcome data exists
 * yet to calibrate this against. Below the ceiling counts as "confident enough" for a single
 * unconfirmed model's own (uncalibrated — see `laya-typed`'s own `known_limitations`) entropy;
 * this is deliberately a looser bar than trust-engine's real drivers, since this whole function is
 * shadow-mode observation, not an authoritative accept.
 */
export const SYSTEM1_THRESHOLDS = {
  kind: 'PARAMETER' as const,
  scope: 'system-1 shadow-routing uncertainty ceiling',
  calibratedBy: 'ASSUMED. No MESH-measured historical outcomes exist yet — revisit once real cases accumulate.',
  uncertaintyCeiling: 0.7,
};

/**
 * First matching branch wins, most disqualifying first — same structure as
 * `decideArbitrationAction`. `caseRisk === 'HIGH'` is checked before any model signal, per the
 * directive's own "regardless" wording.
 */
export function decideSystem1Action(input: System1Input, context: System1Context): ArbitrationDecision {
  if (context.caseRisk === 'HIGH') {
    return {
      action: 'REQUIRE_DEEP_REVIEW',
      rationale: ['this case is flagged HIGH risk — that overrides any model signal, agreement, or confidence below, per the System-1 directive.'],
    };
  }

  if (input.results.length === 0) {
    return {
      action: 'HUMAN_REVIEW',
      rationale: ['no System-1 model result exists for this case at all — nothing to route on, so this defers to a human rather than guessing.'],
    };
  }

  if (input.modelAgreementScore !== null) {
    if (input.disagreement === null) {
      return {
        action: 'ACCEPT_SYSTEM1',
        rationale: [
          `${input.results.length} independent System-1 models answered this case and agreed (model_agreement_score=${input.modelAgreementScore.toFixed(2)}) — a real cross-model signal, not a single uncalibrated model's own confidence.`,
          'status is SHADOW, not LIVE-authoritative (docs/MODEL_ARENA.md): this action is a shadow recommendation for the Observatory, not MESH\'s real Decision for this case.',
        ],
      };
    }
    if (context.swarmAvailable) {
      return {
        action: 'ESCALATE_TO_SWARM',
        rationale: [`${input.results.length} independent System-1 models disagreed (${input.disagreement.model_ids.join(', ')}) — spec §35: a disagreement is a signal, never averaged away, and risk-swarm is reachable to arbitrate it.`],
      };
    }
    return {
      action: 'HUMAN_REVIEW',
      rationale: [`${input.results.length} independent System-1 models disagreed (${input.disagreement.model_ids.join(', ')}), and risk-swarm is not connected in this environment (§58: never fabricate a connection that does not exist) — a human decides instead.`],
    };
  }

  const [only] = input.results;
  if (only && only.uncertainty !== null && only.uncertainty <= SYSTEM1_THRESHOLDS.uncertaintyCeiling) {
    return {
      action: 'ACCEPT',
      rationale: [`the single System-1 model that answered (${only.model_id}) has uncertainty=${only.uncertainty.toFixed(2)}, at or below the ${SYSTEM1_THRESHOLDS.uncertaintyCeiling} ASSUMED ceiling — confident enough to accept, with no second model yet to compare against.`],
    };
  }

  if (context.jevAvailable) {
    return {
      action: 'CALL_JEV',
      rationale: [only?.uncertainty !== null && only?.uncertainty !== undefined
        ? `the single System-1 model that answered has uncertainty=${only.uncertainty.toFixed(2)}, above the ${SYSTEM1_THRESHOLDS.uncertaintyCeiling} ASSUMED ceiling — too uncertain to accept alone. Jev is reachable, so it independently evaluates the same case next.`
        : "the single System-1 model that answered reported no probability distribution to compute uncertainty from — too little signal to accept alone. Jev is reachable, so it independently evaluates the same case next."],
    };
  }

  if (context.swarmAvailable) {
    return {
      action: 'ESCALATE_TO_SWARM',
      rationale: ["the single System-1 model's answer is too uncertain to accept alone, and Jev is UNAVAILABLE in this environment (see adapters/model-registry/registry.ts) — risk-swarm arbitrates instead."],
    };
  }

  return {
    action: 'HUMAN_REVIEW',
    rationale: ["the single System-1 model's answer is too uncertain to accept alone, Jev is UNAVAILABLE, and risk-swarm is not connected either — a human decides instead of MESH guessing."],
  };
}
