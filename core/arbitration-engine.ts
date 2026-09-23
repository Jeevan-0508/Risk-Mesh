/**
 * Deterministic arbitration (spec §12): turns a `TrustAssessment` plus what's actually available
 * right now (is SWARM connected, has replay already run, can more evidence plausibly be requested)
 * into one `ArbitrationAction`, always with a non-empty `rationale` — never a bare label. Per the
 * ecosystem audit, `swarmAvailable` is honestly `false` everywhere in this repo today (risk-swarm has
 * no live/snapshot adapter yet, see INTEGRATION_MATRIX.md); this function takes it as a parameter
 * rather than hard-coding that, so it stops needing an update the day that adapter ships.
 */
import type { ArbitrationAction } from '../contracts/schemas';
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
