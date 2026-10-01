import { z } from 'zod';

const id = z.string().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9_.:\/-]*$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const at = z.string().datetime({ offset: true });
const ids = z.array(id).max(500).refine(v => new Set(v).size === v.length, 'duplicate identifiers');

export const ReviewEvidence = z.object({
  id,
  data_class: z.enum(['external_source_content', 'operator_observation', 'synthetic_simulation', 'model_output']),
  repository: z.string().min(1).max(200),
  source_uri: z.string().url().refine(v => ['https:', 'http:'].includes(new URL(v).protocol)),
  source_revision: z.string().regex(/^[a-f0-9]{40}$/).nullable(),
  retrieved_at: at,
  content: z.string().min(1).max(100_000),
  content_sha256: hash,
  extraction_method: z.enum(['provider_excerpt', 'human_recorded', 'repository_snapshot']),
}).strict();

export const KnowledgeCandidate = z.object({
  schema_version: z.literal('mesh-knowledge-candidate.v1'),
  id,
  version: z.number().int().min(1),
  previous_version: z.number().int().min(1).nullable(),
  created_at: at,
  author_id: id,
  statement: z.string().min(12).max(4000),
  scope: z.enum(['real_world', 'simulation_only']),
  case_id: id,
  source_handoff_sha256: hash,
  hypothesis_context_sha256: hash.nullable(),
  evidence: z.array(ReviewEvidence).min(1).max(500),
  supporting_evidence_ids: ids,
  contradicting_evidence_ids: ids,
  unresolved_questions: z.array(z.string().min(1).max(1000)).max(100),
  target: z.enum(['taxonomy_proposal', 'investigation_guidance', 'control_mapping']),
}).strict();
export type KnowledgeCandidate = z.infer<typeof KnowledgeCandidate>;

export const TrustPolicy = z.object({
  schema_version: z.literal('mesh-trust-policy.v1'),
  id,
  version: z.number().int().positive(),
  reviewer_threshold: z.number().int().min(2).max(10),
  max_review_age_days: z.number().int().min(1).max(366),
  keys: z.array(z.object({
    key_id: id,
    actor_id: id,
    role: z.enum(['human_reviewer', 'benchmark_runner', 'promotion_authority']),
    public_key_pem: z.string().min(20).max(10_000),
  }).strict()).max(100),
}).strict();
export type TrustPolicy = z.infer<typeof TrustPolicy>;

export const HumanValidationReview = z.object({
  kind: z.literal('human_validation_review'),
  candidate_sha256: hash,
  issued_at: at,
  decision: z.enum(['approve', 'reject']),
  evidence_ids: ids,
  source_authenticity_checked: z.boolean(),
  claim_entailment_checked: z.boolean(),
  source_independence_checked: z.boolean(),
  contradictions_checked: z.boolean(),
  rationale: z.string().min(12).max(4000),
}).strict();

export const RegressionReceipt = z.object({
  kind: z.literal('regression_receipt'),
  candidate_sha256: hash,
  versioned_update_sha256: hash,
  issued_at: at,
  dataset_id: id,
  dataset_sha256: hash,
  code_revision: z.string().regex(/^[a-f0-9]{40}$/),
  evaluation_scope: z.literal('regression_only_not_empirical_truth'),
  case_ids: ids.refine(v => v.length > 0, 'no regression cases'),
  passed_ids: ids,
  failed_ids: ids,
}).strict();

export const SignedReview = z.object({
  schema_version: z.literal('mesh-attestation.v1'),
  key_id: id,
  payload: HumanValidationReview,
  signature: z.string().regex(/^[A-Za-z0-9+/]{86}==$/),
}).strict();
export const SignedRegression = SignedReview.extend({ payload: RegressionReceipt });
export const ValidationBundle = z.object({
  schema_version: z.literal('mesh-validation-bundle.v1'),
  candidate: KnowledgeCandidate,
  reviews: z.array(SignedReview).min(2).max(10),
  regression: SignedRegression,
}).strict();
export type ValidationBundle = z.infer<typeof ValidationBundle>;
