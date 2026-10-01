// Ephemeral contract-test identities and illustrative data. Never deployment trust or empirical validation.
import { generateKeyPairSync } from 'node:crypto';
import type { KnowledgeCandidate, TrustPolicy, ValidationBundle } from '../../contracts/knowledge-validation';
import { digest, sha256, signAttestation, versionedUpdate, verifyKnowledgeValidation } from '../controlled-validation';

export const REVIEW_AT = '2026-09-30T09:30:00.000Z';
export const VERIFIED_AT = '2026-09-30T10:00:00.000Z';
const identities = ['reviewer-1', 'reviewer-2', 'runner'].map((actor_id, i) => {
  const pair = generateKeyPairSync('ed25519');
  return { actor_id, key_id: actor_id + '-key', role: i < 2 ? 'human_reviewer' as const : 'benchmark_runner' as const,
    public_key_pem: pair.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    private_key_pem: pair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString() };
});

export function validationFixture(overrides: Partial<KnowledgeCandidate> = {}) {
  const content = 'Illustrative external-source contract fixture. This is not an empirical finding.';
  const candidate: KnowledgeCandidate = {
    schema_version: 'mesh-knowledge-candidate.v1', id: 'know-1', version: 1, previous_version: null,
    created_at: '2026-09-30T09:00:00.000Z', author_id: 'test-author',
    statement: 'Illustrative claim for isolated validation contract testing.', scope: 'real_world',
    case_id: 'case-test', source_handoff_sha256: 'a'.repeat(64), hypothesis_context_sha256: null,
    evidence: [{ id: 'external-1', data_class: 'external_source_content', repository: 'contract-fixture',
      source_uri: 'https://example.invalid/contract-fixture', source_revision: null,
      retrieved_at: '2026-09-30T08:00:00.000Z', content, content_sha256: sha256(content), extraction_method: 'provider_excerpt' }],
    supporting_evidence_ids: ['external-1'], contradicting_evidence_ids: [], unresolved_questions: [],
    target: 'investigation_guidance', ...overrides,
  };
  const policy: TrustPolicy = {
    schema_version: 'mesh-trust-policy.v1', id: 'isolated-test-policy', version: 1,
    reviewer_threshold: 2, max_review_age_days: 7,
    keys: identities.map(({ private_key_pem: _secret, ...publicIdentity }) => publicIdentity),
  };
  const reviews = identities.slice(0, 2).map(identity => signAttestation({
    kind: 'human_validation_review' as const, candidate_sha256: digest(candidate), issued_at: REVIEW_AT,
    decision: 'approve' as const, evidence_ids: candidate.supporting_evidence_ids,
    source_authenticity_checked: true, claim_entailment_checked: true,
    source_independence_checked: true, contradictions_checked: true,
    rationale: 'Isolated test attestation only; no real source or human validation occurred.',
  }, identity.key_id, identity.private_key_pem));
  const runner = identities[2]!;
  const regression = signAttestation({
    kind: 'regression_receipt' as const, candidate_sha256: digest(candidate),
    versioned_update_sha256: digest(versionedUpdate(candidate)), issued_at: '2026-09-30T09:45:00.000Z',
    dataset_id: 'contract-test-fixture', dataset_sha256: 'b'.repeat(64), code_revision: 'c'.repeat(40),
    evaluation_scope: 'regression_only_not_empirical_truth' as const,
    case_ids: ['case-1'], passed_ids: ['case-1'], failed_ids: [],
  }, runner.key_id, runner.private_key_pem);
  const bundle: ValidationBundle = { schema_version: 'mesh-validation-bundle.v1', candidate, reviews, regression };
  return { candidate, policy, bundle, permit: () => verifyKnowledgeValidation(bundle, policy, VERIFIED_AT) };
}
