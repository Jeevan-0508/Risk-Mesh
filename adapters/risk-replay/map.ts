/**
 * Translation between risk-replay's real wire vocabulary and MESH's contracts (spec §3). Kept
 * separate from `client.ts` on purpose: every mapping decision below is a place a mismatch could be
 * silently papered over, so each one is named and, where the two vocabularies don't actually agree,
 * left unmapped rather than guessed.
 */
import type { RiskReplayCounterfactualOut, RiskReplayDecisionDetail, RiskReplayMutationIn } from './client';
import type { Evidence, MutationType, Replay, ReplayResult } from '../../contracts/schemas';

/**
 * MESH's `MutationType` (spec §18 prose) and risk-replay's real `MutationType` enum
 * (`backend/app/domain/enums.py`) were defined independently and do not fully agree:
 *
 *   MESH-only, no risk-replay equivalent: REMOVE_SIGNAL, ALTER_TIMELINE, MODIFY_CONTEXT, MODIFY_CONTROL
 *     (risk-replay's CHANGE_INPUT and DISABLE_CONTROL are close but narrower than MODIFY_CONTEXT/
 *     MODIFY_CONTROL — treated as distinct rather than equated).
 *   risk-replay-only, no MESH equivalent: ADD_EVIDENCE, MODIFY_EVIDENCE, MODIFY_TOOL_RESULT, CHANGE_INPUT,
 *     DISABLE_CONTROL.
 *
 * Only the five below have the same name and the same real meaning in both systems.
 */
const MUTATION_TYPE_MESH_TO_RISK_REPLAY: Partial<Record<MutationType, RiskReplayMutationIn['type']>> = {
  REMOVE_EVIDENCE: 'REMOVE_EVIDENCE',
  CHANGE_POLICY: 'CHANGE_POLICY',
  CHANGE_MODEL: 'CHANGE_MODEL',
  CHANGE_THRESHOLD: 'CHANGE_THRESHOLD',
  REMOVE_TOOL_RESULT: 'REMOVE_TOOL_RESULT',
};

export type MutationMapResult =
  | { ok: true; riskReplayType: RiskReplayMutationIn['type'] }
  | { ok: false; reason: string };

export function mapMutationType(meshType: MutationType): MutationMapResult {
  const mapped = MUTATION_TYPE_MESH_TO_RISK_REPLAY[meshType];
  if (mapped) return { ok: true, riskReplayType: mapped };
  return { ok: false, reason: `MESH mutation type "${meshType}" has no risk-replay equivalent; cannot request this mutation from the live adapter.` };
}

/**
 * risk-replay evidence has no independence/reliability judgement of its own — those are MESH
 * concepts (spec §5). This maps only what risk-replay actually asserts (a weight and a content hash)
 * and leaves `reliability`/`independent` to be set by whatever calls this, rather than inventing
 * values risk-replay never claimed.
 */
export function decisionEvidenceToMeshEvidence(
  detail: RiskReplayDecisionDetail,
  caseId: string,
  observedAt: string,
): Array<Omit<Evidence, 'reliability' | 'independent'> & { reliability: null; independent: null }> {
  return detail.evidence.map((e) => ({
    id: `risk-replay-evidence-${detail.decision_id}-${e.evidence_id}`,
    schema_version: '1.0',
    created_at: observedAt,
    source: 'risk-replay-adapter',
    provenance: {
      source: 'LIVE' as const,
      system: 'risk-replay-backend',
      retrieved_at: observedAt,
      upstream_ref: e.content_hash,
      note: `weight=${e.weight}, classification=${e.classification}`,
    },
    status: 'VERIFIED' as const,
    case_id: caseId,
    source_type: e.source,
    observed_at: observedAt,
    content_hash: e.content_hash,
    reliability: null,
    independent: null,
  }));
}

/**
 * §18: a replay result is never "the true cause" — it's scoped to this replay model. This function
 * only runs the STABLE/FRAGILE branch (the decision was replayable and a counterfactual was actually
 * executed); NON_REPLAYABLE is decided upstream from `replayability_status` before a counterfactual
 * is even attempted, and FAILED is for a request that errored, which by definition never reaches here.
 */
export function counterfactualToReplay(
  cf: RiskReplayCounterfactualOut,
  caseId: string,
  decisionId: string,
  mutationType: MutationType,
  observedAt: string,
): Replay {
  const status: ReplayResult = cf.diverged ? 'FRAGILE' : 'STABLE';
  return {
    id: `risk-replay-replay-${cf.counterfactual_id}`,
    schema_version: '1.0',
    created_at: observedAt,
    source: 'risk-replay-adapter',
    provenance: {
      source: 'LIVE',
      system: 'risk-replay-backend',
      retrieved_at: observedAt,
      upstream_ref: cf.counterfactual_id,
      note: `causal_status=${cf.causal_status}`,
    },
    status,
    case_id: caseId,
    decision_id: decisionId,
    mutation_type: mutationType,
    finding: `${cf.causal_explanation} (risk-replay causal_status: ${cf.causal_status}; MESH replay result: ${status})`,
  };
}

export function nonReplayableFinding(detail: RiskReplayDecisionDetail, caseId: string, decisionId: string, mutationType: MutationType, observedAt: string): Replay {
  return {
    id: `risk-replay-replay-${detail.decision_id}-nonreplayable-${observedAt}`,
    schema_version: '1.0',
    created_at: observedAt,
    source: 'risk-replay-adapter',
    provenance: {
      source: 'LIVE',
      system: 'risk-replay-backend',
      retrieved_at: observedAt,
      upstream_ref: detail.context_hash,
      note: `replayability_status=${detail.replayability_status}`,
    },
    status: 'NON_REPLAYABLE',
    case_id: caseId,
    decision_id: decisionId,
    mutation_type: mutationType,
    finding: detail.replayability_reasons.length > 0
      ? `risk-replay reports this decision as ${detail.replayability_status}: ${detail.replayability_reasons.join(', ')}`
      : `risk-replay reports this decision as ${detail.replayability_status} with no reasons given.`,
  };
}
