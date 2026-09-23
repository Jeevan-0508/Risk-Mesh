/**
 * Type-level mirror of risk-swarm's real council output shapes
 * (`src/core/council/types.ts`, risk-swarm commit `d9df7886852cbaabeed3163b330c080352ed687e`,
 * 2026-09-22), copied field-for-field, its vocabulary, not MESH's.
 *
 * Unlike the risk-replay adapter, there is no `client.ts` here: per Phase 0's audit, risk-swarm has
 * no server and no persisted export of its council output anywhere on disk (only snapshot files it
 * *pulls in* from FOMO/freight-risk-atlas/ai-governance-control-room, none it pushes out). It runs
 * entirely in-browser against a user's own BYOK key, which this sandbox does not have. `map.ts`
 * therefore takes an already-produced `CouncilResult` as a plain argument — however the caller
 * obtained it (a real live run, or `risk-swarm`'s own persisted snapshot once one exists) — and never
 * fetches anything itself.
 */

export type ReasoningAgent = 'ATHENA' | 'ARES' | 'HADES';

export interface OlympianPosition {
  agent: ReasoningAgent;
  stance: string;
  confidence: number;
  reasoning_summary: string;
  claims: string[];
  evidence_ids: string[];
  evidence_requests: string[];
  assumptions: string[];
}

export type VerdictType = 'CONSENSUS' | 'MAJORITY' | 'MINORITY_PRESERVED' | 'UNRESOLVED';

export interface CouncilVerdict {
  verdict_type: VerdictType;
  answer: string;
  confidence: number;
  rationale: string[];
  minority_view: string | null;
  unresolved: string[];
  cited_evidence_ids: string[];
}

export type AgreementLevel = 'strong_consensus' | 'majority' | 'split' | 'inconclusive';

export interface DisagreementAssessment {
  independent_count: number;
  stances: Record<ReasoningAgent, string>;
  distinct_stances: string[];
  confidence_variance: number;
  agreement: AgreementLevel;
}

export interface CouncilPositionEntry {
  position: OlympianPosition;
  provider: string;
  degraded: boolean;
  degraded_reason: string | null;
  ms: number;
  est_tokens: number;
}

export interface CouncilResult {
  question: string;
  positions: Record<ReasoningAgent, CouncilPositionEntry>;
  disagreement: DisagreementAssessment;
  verdict: { verdict: CouncilVerdict; provider: string; degraded: boolean; degraded_reason: string | null };
  trace: Array<{ at: string; kind: string; agent?: string; detail: string }>;
  model_diversity: { active_agents: number; providers: number; label: string };
}
