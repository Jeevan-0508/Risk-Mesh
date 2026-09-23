/**
 * RISK//MESH canonical contracts (spec §3). Zod is the single source of truth, matching the
 * convention already established in risk-swarm's `src/core/domain/model.ts`: every exported type is
 * `z.infer`'d from the schema that validates it, so nothing here can drift out of sync with itself.
 *
 * `MeshBase.source` and `Provenance.source` are deliberately different things with the same name:
 * `source` on the object itself is a free-text label for the component that produced it (e.g.
 * "risk-swarm-adapter"); `provenance.source` is the fixed six-value honesty label from spec §58
 * (LIVE/SNAPSHOT/SIMULATED/MOCKED/CACHED/UNAVAILABLE). Conflating them would let a component name
 * stand in for a trust level, which is exactly the ambiguity §58 exists to prevent.
 */
import { z } from 'zod';

export const MeshId = z.string().min(1);
export type MeshId = z.infer<typeof MeshId>;

export const IsoTimestamp = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'must be a parseable ISO-8601 timestamp' });
export type IsoTimestamp = z.infer<typeof IsoTimestamp>;

/** The six honest labels from spec §58. No seventh value, no blank, ever. */
export const ProvenanceSource = z.enum(['LIVE', 'SNAPSHOT', 'SIMULATED', 'MOCKED', 'CACHED', 'UNAVAILABLE']);
export type ProvenanceSource = z.infer<typeof ProvenanceSource>;

export const Provenance = z.object({
  source: ProvenanceSource,
  /** The system that actually produced the underlying data, e.g. "risk-replay-backend". */
  system: z.string().min(1),
  retrieved_at: IsoTimestamp,
  /** Commit hash, URL, or API request id the data can be traced back to. `null` when honestly unknown. */
  upstream_ref: z.string().nullable(),
  note: z.string().nullable(),
});
export type Provenance = z.infer<typeof Provenance>;

/**
 * Fields every MESH object carries, per spec §3. The "where applicable" fields (`parent_id`,
 * `model_id`, `model_version`, `evidence_ids`, `case_id`, `experiment_id`) are optional here rather
 * than split into a second base type: a schema that doesn't use one simply never sets it, which is a
 * smaller surface than maintaining two base types that must be kept in sync.
 */
export const MeshBase = z.object({
  id: MeshId,
  schema_version: z.string().min(1),
  created_at: IsoTimestamp,
  source: z.string().min(1),
  provenance: Provenance,
  status: z.string().min(1),
  parent_id: MeshId.nullable().optional(),
  model_id: z.string().min(1).nullable().optional(),
  model_version: z.string().min(1).nullable().optional(),
  evidence_ids: z.array(MeshId).optional(),
  case_id: MeshId.nullable().optional(),
  experiment_id: MeshId.nullable().optional(),
});
export type MeshBase = z.infer<typeof MeshBase>;

// ---------------------------------------------------------------------------------------------
// 1. Case (§4)
// ---------------------------------------------------------------------------------------------

export const CaseStatus = z.enum(['OPEN', 'INVESTIGATING', 'DECIDED', 'CLOSED', 'REOPENED']);
export type CaseStatus = z.infer<typeof CaseStatus>;

export const Case = MeshBase.extend({
  status: CaseStatus,
  title: z.string().min(1),
  summary: z.string().min(1),
  signal_ids: z.array(MeshId).default([]),
  entity_ids: z.array(z.string().min(1)).default([]),
  behavior_ids: z.array(MeshId).default([]),
  decision_ids: z.array(MeshId).default([]),
  disagreement_ids: z.array(MeshId).default([]),
  challenge_ids: z.array(MeshId).default([]),
  replay_ids: z.array(MeshId).default([]),
  outcome_id: MeshId.nullable().default(null),
  lesson_ids: z.array(MeshId).default([]),
});
export type Case = z.infer<typeof Case>;

// ---------------------------------------------------------------------------------------------
// 2. Evidence (§5)
// ---------------------------------------------------------------------------------------------

export const EvidenceStatus = z.enum(['UNVERIFIED', 'VERIFIED', 'CONTRADICTED', 'SUPERSEDED', 'REJECTED']);
export type EvidenceStatus = z.infer<typeof EvidenceStatus>;

export const Evidence = MeshBase.extend({
  status: EvidenceStatus,
  source_type: z.string().min(1),
  observed_at: IsoTimestamp,
  content_hash: z.string().min(1),
  reliability: z.number().min(0).max(1),
  /** True only if this evidence was obtained independently of every other evidence item cited alongside it. */
  independent: z.boolean(),
});
export type Evidence = z.infer<typeof Evidence>;

// ---------------------------------------------------------------------------------------------
// 3. Signal (§24) — external/raw input; never trusted by default (Rule 4).
// ---------------------------------------------------------------------------------------------

export const SignalStatus = z.enum(['RAW', 'PROMOTED_TO_EVIDENCE', 'REJECTED']);
export type SignalStatus = z.infer<typeof SignalStatus>;

export const Signal = MeshBase.extend({
  status: SignalStatus,
  signal_type: z.string().min(1),
  /** Retrieved content is data, never instruction (§24) — callers must not eval/interpret this as directives. */
  payload: z.record(z.unknown()),
  external: z.boolean(),
});
export type Signal = z.infer<typeof Signal>;

// ---------------------------------------------------------------------------------------------
// 4. Behavior (§16) — Fraud Watch's adversarial vocabulary, kept distinct from real-world MOs.
// ---------------------------------------------------------------------------------------------

export const BehaviorKind = z.enum([
  'KNOWN_MO', 'MO_VARIANT', 'COMPOSITE_MO', 'CANDIDATE_NEW_MO',
  'EMERGING_BEHAVIOR', 'BENIGN_VARIANT', 'FALSE_POSITIVE', 'EDGE_CASE',
]);
export type BehaviorKind = z.infer<typeof BehaviorKind>;

export const Behavior = MeshBase.extend({
  status: z.enum(['SIMULATED', 'PROVISIONAL', 'CONFIRMED']),
  kind: BehaviorKind,
  description: z.string().min(1),
  /** Fraud Watch's hidden ground truth (§16) must never leak in here. */
  simulated: z.boolean(),
});
export type Behavior = z.infer<typeof Behavior>;

// ---------------------------------------------------------------------------------------------
// 5. Decision (§12)
// ---------------------------------------------------------------------------------------------

export const ArbitrationAction = z.enum([
  'ACCEPT', 'CONDITIONAL', 'ESCALATE_TO_SWARM', 'REQUEST_MORE_EVIDENCE',
  'REQUEST_REPLAY', 'HUMAN_REVIEW', 'ABSTAIN',
  // System-1 directive additions (2026-09-23): reachable only via decideSystem1Action() in
  // core/arbitration-engine.ts, a shadow-mode-only sibling to decideArbitrationAction() — Laya's
  // registry status is SHADOW, so nothing in this repo wires these into a case's real Decision yet.
  'ACCEPT_SYSTEM1', 'CALL_JEV', 'REQUIRE_DEEP_REVIEW',
]);
export type ArbitrationAction = z.infer<typeof ArbitrationAction>;

export const Decision = MeshBase.extend({
  status: z.enum(['DRAFT', 'FINAL', 'SUPERSEDED']),
  case_id: MeshId,
  action: ArbitrationAction,
  /** The arbiter must explain why (§12) — never a bare label with no reasoning trail. */
  rationale: z.array(z.string().min(1)).min(1),
  decided_by: z.string().min(1),
});
export type Decision = z.infer<typeof Decision>;

// ---------------------------------------------------------------------------------------------
// 6. Model result (§11)
// ---------------------------------------------------------------------------------------------

export const ModelPrimitive = z.enum(['choice', 'score', 'noul']);
export type ModelPrimitive = z.infer<typeof ModelPrimitive>;

export const ModelResult = MeshBase.extend({
  status: z.enum(['RECORDED', 'SUPERSEDED']),
  case_id: MeshId,
  model_id: z.string().min(1),
  checkpoint: z.string().min(1),
  decision: z.string().min(1),
  probabilities: z.record(z.number().min(0).max(1)).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  /** MESH-computed normalized Shannon entropy of `probabilities` (System-1 directive §7) — a real
   * derived statistic, not a native model field. `null` when `probabilities` is null (nothing to
   * compute from) rather than invented. Never a arithmetic negation of `confidence`: that would
   * misrepresent a derived number as if the model reported a second, independent signal. */
  uncertainty: z.number().min(0).max(1).nullable(),
  /** The model's own question-type taxonomy where the model has one (e.g. Laya's choice/score/noul),
   * `null` for a model that doesn't distinguish. */
  primitive: ModelPrimitive.nullable(),
  latency_ms: z.number().nonnegative().nullable(),
  /** The full, untruncated raw answer object the runtime returned, for traceability (System-1
   * directive §7's "preserve raw decision"). `null` only when no live call was ever made. */
  raw_output: z.record(z.unknown()).nullable(),
});
export type ModelResult = z.infer<typeof ModelResult>;

// ---------------------------------------------------------------------------------------------
// 7. Disagreement (§35) — a signal, never averaged away.
// ---------------------------------------------------------------------------------------------

export const Disagreement = MeshBase.extend({
  status: z.enum(['OPEN', 'RESOLVED']),
  case_id: MeshId,
  model_ids: z.array(z.string().min(1)).min(2),
  positions: z.array(z.object({ model_id: z.string().min(1), stance: z.string().min(1), confidence: z.number().min(0).max(1).nullable() })).min(2),
  resolution: z.string().nullable(),
});
export type Disagreement = z.infer<typeof Disagreement>;

// ---------------------------------------------------------------------------------------------
// 8. Challenge (§15 red team / SWARM challenge)
// ---------------------------------------------------------------------------------------------

export const Challenge = MeshBase.extend({
  status: z.enum(['OPEN', 'UPHELD', 'DISMISSED']),
  case_id: MeshId,
  target_decision_id: MeshId,
  challenge_type: z.string().min(1),
  finding: z.string().min(1),
});
export type Challenge = z.infer<typeof Challenge>;

// ---------------------------------------------------------------------------------------------
// 9. Replay (§18)
// ---------------------------------------------------------------------------------------------

export const MutationType = z.enum([
  'REMOVE_EVIDENCE', 'REMOVE_SIGNAL', 'ALTER_TIMELINE', 'CHANGE_THRESHOLD', 'CHANGE_POLICY',
  'CHANGE_MODEL', 'REMOVE_TOOL_RESULT', 'MODIFY_CONTROL', 'MODIFY_CONTEXT',
]);
export type MutationType = z.infer<typeof MutationType>;

export const ReplayResult = z.enum(['STABLE', 'FRAGILE', 'FAILED', 'NON_REPLAYABLE']);
export type ReplayResult = z.infer<typeof ReplayResult>;

export const Replay = MeshBase.extend({
  status: ReplayResult,
  case_id: MeshId,
  decision_id: MeshId,
  mutation_type: MutationType,
  /** Never "the true cause" (§18) — the finding is scoped to the replay model that produced it. */
  finding: z.string().min(1),
});
export type Replay = z.infer<typeof Replay>;

// ---------------------------------------------------------------------------------------------
// 10. Candidate MO (§17)
// ---------------------------------------------------------------------------------------------

export const MoClassification = z.enum(['KNOWN_MO', 'VARIANT', 'COMPOSITE', 'POTENTIAL_NEW_MO', 'REJECTED', 'BENIGN']);
export type MoClassification = z.infer<typeof MoClassification>;

export const CandidateMo = MeshBase.extend({
  status: MoClassification,
  case_id: MeshId,
  taxonomy_version: z.string().min(1),
  taxonomy_hash: z.string().min(1),
  reproducible: z.boolean(),
  distinct_from_existing: z.boolean(),
});
export type CandidateMo = z.infer<typeof CandidateMo>;

// ---------------------------------------------------------------------------------------------
// 11. Outcome
// ---------------------------------------------------------------------------------------------

export const OutcomeStatus = z.enum(['RECORDED', 'AMENDED']);
export type OutcomeStatus = z.infer<typeof OutcomeStatus>;

export const Outcome = MeshBase.extend({
  status: OutcomeStatus,
  case_id: MeshId,
  decision_id: MeshId,
  observed_at: IsoTimestamp,
  actual_result: z.string().min(1),
  matches_prediction: z.boolean().nullable(),
});
export type Outcome = z.infer<typeof Outcome>;

// ---------------------------------------------------------------------------------------------
// 12. Lesson (§27, §29)
// ---------------------------------------------------------------------------------------------

export const LessonStatus = z.enum(['CANDIDATE', 'VERIFIED', 'VALIDATED', 'ADOPTED', 'SUPERSEDED', 'REJECTED', 'DECAYED']);
export type LessonStatus = z.infer<typeof LessonStatus>;

export const Lesson = MeshBase.extend({
  status: LessonStatus,
  source_case_id: MeshId,
  original_prediction: z.string().min(1),
  actual_outcome: z.string().min(1),
  error_type: z.string().min(1),
  root_cause: z.string().min(1),
  affected_models: z.array(z.string().min(1)).default([]),
  affected_rules: z.array(z.string().min(1)).default([]),
  version: z.number().int().positive(),
});
export type Lesson = z.infer<typeof Lesson>;

// ---------------------------------------------------------------------------------------------
// 13. Knowledge (§28, §51)
// ---------------------------------------------------------------------------------------------

export const KnowledgeStatus = z.enum(['ACTIVE', 'STALE', 'SUPERSEDED', 'CONTRADICTED']);
export type KnowledgeStatus = z.infer<typeof KnowledgeStatus>;

export const Knowledge = MeshBase.extend({
  status: KnowledgeStatus,
  statement: z.string().min(1),
  version: z.number().int().positive(),
  last_confirmed: IsoTimestamp,
  confidence: z.number().min(0).max(1),
  validation_count: z.number().int().nonnegative(),
  contradiction_count: z.number().int().nonnegative(),
  decay_policy: z.string().min(1),
});
export type Knowledge = z.infer<typeof Knowledge>;

// ---------------------------------------------------------------------------------------------
// 14. Review (§46 — human control)
// ---------------------------------------------------------------------------------------------

export const HumanRecommendation = z.enum(['APPROVE', 'BLOCK', 'MONITOR', 'ESCALATE', 'INVESTIGATE', 'HUMAN_REQUIRED']);
export type HumanRecommendation = z.infer<typeof HumanRecommendation>;

export const Review = MeshBase.extend({
  status: z.enum(['PENDING', 'COMPLETE']),
  case_id: MeshId,
  decision_id: MeshId.nullable(),
  reviewer: z.string().min(1),
  system_recommendation: HumanRecommendation.nullable(),
  human_decision: HumanRecommendation.nullable(),
  rationale: z.string().nullable(),
});
export type Review = z.infer<typeof Review>;

// ---------------------------------------------------------------------------------------------
// 15. Trust (§34)
// ---------------------------------------------------------------------------------------------

export const TrustVerdict = z.enum(['TRUSTED', 'CONDITIONAL', 'UNCERTAIN', 'ESCALATE', 'BLOCKED']);
export type TrustVerdict = z.infer<typeof TrustVerdict>;

/** Every driver named explicitly (§34: "show every driver") — never a single opaque trust score. */
export const TrustDrivers = z.object({
  evidence_quality: z.number().min(0).max(1),
  evidence_independence: z.number().min(0).max(1),
  model_calibration: z.number().min(0).max(1).nullable(),
  model_historical_accuracy: z.number().min(0).max(1).nullable(),
  model_agreement: z.number().min(0).max(1).nullable(),
  novelty: z.number().min(0).max(1),
  replay_stability: z.number().min(0).max(1).nullable(),
  contradiction_count: z.number().int().nonnegative(),
  source_quality: z.number().min(0).max(1),
  human_validation: z.boolean(),
});
export type TrustDrivers = z.infer<typeof TrustDrivers>;

export const Trust = MeshBase.extend({
  status: TrustVerdict,
  case_id: MeshId,
  drivers: TrustDrivers,
});
export type Trust = z.infer<typeof Trust>;

// ---------------------------------------------------------------------------------------------
// 16. Experiment (§41)
// ---------------------------------------------------------------------------------------------

export const Experiment = MeshBase.extend({
  status: z.enum(['PLANNED', 'RUNNING', 'COMPLETE', 'FAILED']),
  seed: z.string().min(1),
  dataset_hash: z.string().min(1),
  configuration: z.record(z.unknown()),
  environment: z.record(z.unknown()),
  outputs: z.record(z.unknown()).nullable(),
  metrics: z.record(z.number()).nullable(),
});
export type Experiment = z.infer<typeof Experiment>;

// ---------------------------------------------------------------------------------------------
// 17. Model profile (§10)
// ---------------------------------------------------------------------------------------------

export const BenchmarkResultKind = z.enum(['SELF_REPORTED', 'THIRD_PARTY', 'MESH_MEASURED']);
export type BenchmarkResultKind = z.infer<typeof BenchmarkResultKind>;

export const BenchmarkResult = z.object({
  metric: z.string().min(1),
  value: z.number(),
  dataset: z.string().min(1),
  dataset_version: z.string().min(1),
  kind: BenchmarkResultKind,
});
export type BenchmarkResult = z.infer<typeof BenchmarkResult>;

export const ModelProfile = MeshBase.extend({
  /** System-1 directive's richer enum, replacing the original ACTIVE/DEPRECATED/NOT_CONNECTED:
   * LIVE = connected AND cleared by policy to influence real decisions (none yet — MESH-wide
   * routing stays in shadow mode until the directive's stop-conditions are met);
   * SHADOW = connected, real inference confirmed, but only feeding shadow-mode observation;
   * UNAVAILABLE = no working connection (the old NOT_CONNECTED, renamed to match the
   * directive's vocabulary); DISABLED = intentionally turned off by an operator; ERROR = a
   * configured connection that failed; DEPRECATED = retired. */
  status: z.enum(['LIVE', 'SHADOW', 'UNAVAILABLE', 'DISABLED', 'ERROR', 'DEPRECATED']),
  provider: z.string().min(1),
  checkpoint: z.string().min(1),
  license: z.string().min(1).nullable(),
  runtime: z.string().min(1).nullable(),
  parameter_count: z.number().int().positive().nullable(),
  context_limit: z.number().int().positive().nullable(),
  supported_languages: z.array(z.string().min(1)),
  question_types: z.array(z.string().min(1)),
  calibration_method: z.string().min(1).nullable(),
  benchmark_results: z.array(BenchmarkResult),
  known_limitations: z.array(z.string().min(1)),
});
export type ModelProfile = z.infer<typeof ModelProfile>;
