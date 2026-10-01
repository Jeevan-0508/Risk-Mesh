import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { KnowledgeCandidate, TrustPolicy, ValidationBundle } from '../contracts/knowledge-validation';

/** Canonical JSON for the narrow JSON contracts. Reject non-JSON values/prototype keys, no coercion. */
export function canonicalJson(value: unknown, depth = 0): string {
  if (depth > 32) throw new Error('JSON nesting limit exceeded');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(v => canonicalJson(v, depth + 1)).join(',') + ']';
  if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    return '{' + Object.keys(value).sort().map(key => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unsafe object key');
      return JSON.stringify(key) + ':' + canonicalJson((value as Record<string, unknown>)[key], depth + 1);
    }).join(',') + '}';
  }
  throw new Error('Only finite JSON values are accepted');
}
export function sha256(value: string): string { return createHash('sha256').update(value, 'utf8').digest('hex'); }
export function digest(value: unknown): string { return sha256(canonicalJson(value)); }
export function parseBoundedJson(text: string): unknown {
  if (Buffer.byteLength(text, 'utf8') > 2_000_000) throw new Error('JSON exceeds 2 MB');
  const parsed: unknown = JSON.parse(text);
  canonicalJson(parsed);
  return parsed;
}

export function versionedUpdate(candidate: KnowledgeCandidate) {
  return {
    schema_version: 'mesh-versioned-update.v1' as const,
    candidate_id: candidate.id, version: candidate.version, previous_version: candidate.previous_version,
    statement: candidate.statement, target: candidate.target,
    evidence_ids: [...candidate.supporting_evidence_ids].sort(),
    source_handoff_sha256: candidate.source_handoff_sha256,
    application: 'proposal_requires_repository_review' as const,
  };
}

/** Signing is a local CLI operation with an explicit private-key file; no credentials are generated or embedded. */
export function signAttestation<T>(payload: T, keyId: string, privateKeyPem: string) {
  const unsigned = { schema_version: 'mesh-attestation.v1' as const, key_id: keyId, payload };
  return { ...unsigned, signature: sign(null, Buffer.from(canonicalJson(unsigned)), privateKeyPem).toString('base64') };
}

export interface ValidationPermit {
  readonly candidate: KnowledgeCandidate;
  readonly candidate_sha256: string;
  readonly validation_bundle_sha256: string;
  readonly trust_policy_sha256: string;
  readonly validated_at: string;
  readonly reviewer_ids: readonly string[];
  readonly regression_id: string;
}
const permits = new WeakSet<object>();
const permitDigests = new WeakMap<object, string>();

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return canonicalJson([...a].sort()) === canonicalJson([...b].sort());
}

/** Trust policy comes from operator configuration, NEVER from a submitted package. */
export function verifyKnowledgeValidation(raw: unknown, trustedPolicy: unknown, asOf: string): ValidationPermit {
  const bundle = ValidationBundle.parse(raw);
  const policy = TrustPolicy.parse(trustedPolicy);
  const now = Date.parse(asOf);
  if (!Number.isFinite(now)) throw new Error('Invalid verification time');
  const candidate = bundle.candidate;
  const candidateHash = digest(candidate);
  if (candidate.scope !== 'real_world') throw new Error('Synthetic knowledge remains provisional');
  if (candidate.version !== (candidate.previous_version ?? 0) + 1) throw new Error('Knowledge version must advance exactly once');
  if (candidate.unresolved_questions.length || candidate.contradicting_evidence_ids.length) throw new Error('Unresolved uncertainty or source disagreement blocks promotion');
  const evidence = new Map(candidate.evidence.map(item => [item.id, item]));
  if (evidence.size !== candidate.evidence.length) throw new Error('Duplicate evidence identifiers');
  if (!candidate.supporting_evidence_ids.length) throw new Error('Evidence is insufficient');
  for (const item of candidate.evidence) {
    if (sha256(item.content) !== item.content_sha256) throw new Error('Evidence content hash mismatch');
    if (Date.parse(item.retrieved_at) > Date.parse(candidate.created_at)) throw new Error('Evidence postdates the candidate');
  }
  for (const evidenceId of candidate.supporting_evidence_ids) {
    const item = evidence.get(evidenceId);
    if (!item || !['external_source_content', 'operator_observation'].includes(item.data_class)) {
      throw new Error('Synthetic content and model output cannot validate real-world knowledge');
    }
  }
  const keys = new Map(policy.keys.map(key => [key.key_id, key]));
  if (keys.size !== policy.keys.length) throw new Error('Duplicate trusted key IDs');

  function authenticate(envelope: {schema_version: string; key_id: string; payload: {issued_at: string; candidate_sha256: string}; signature: string}, role: string) {
    const trusted = keys.get(envelope.key_id);
    if (!trusted || trusted.role !== role) throw new Error('Unknown or unauthorized attestation key');
    const publicKey = createPublicKey(trusted.public_key_pem);
    if (publicKey.asymmetricKeyType !== 'ed25519') throw new Error('Only configured Ed25519 keys are accepted');
    const { signature, ...unsigned } = envelope;
    if (!verify(null, Buffer.from(canonicalJson(unsigned)), publicKey, Buffer.from(signature, 'base64'))) throw new Error('Invalid attestation signature');
    if (envelope.payload.candidate_sha256 !== candidateHash) throw new Error('Attestation is bound to another candidate/version');
    const issued = Date.parse(envelope.payload.issued_at);
    if (issued < Date.parse(candidate.created_at) || issued > now || now - issued > policy.max_review_age_days * 86400000) throw new Error('Attestation chronology or expiry is invalid');
    return trusted;
  }

  const reviewers = new Set<string>();
  let latestReview = 0;
  for (const envelope of bundle.reviews) {
    const reviewer = authenticate(envelope, 'human_reviewer');
    if (reviewer.actor_id === candidate.author_id) throw new Error('Author cannot independently review their own candidate');
    if (reviewers.has(reviewer.actor_id)) throw new Error('Reviewers must represent distinct configured identities');
    const review = envelope.payload;
    if (review.decision !== 'approve' || !review.source_authenticity_checked || !review.claim_entailment_checked ||
        !review.source_independence_checked || !review.contradictions_checked || !sameIds(review.evidence_ids, candidate.supporting_evidence_ids)) {
      throw new Error('Independent human review is incomplete or rejected');
    }
    reviewers.add(reviewer.actor_id);
    latestReview = Math.max(latestReview, Date.parse(review.issued_at));
  }
  if (reviewers.size < policy.reviewer_threshold) throw new Error('Insufficient independent human approvals');
  const runner = authenticate(bundle.regression, 'benchmark_runner');
  if (runner.actor_id === candidate.author_id || reviewers.has(runner.actor_id)) throw new Error('Regression runner must be independent of author/reviewers');
  const regression = bundle.regression.payload;
  if (regression.versioned_update_sha256 !== digest(versionedUpdate(candidate)) ||
      regression.failed_ids.length || !sameIds(regression.case_ids, regression.passed_ids) ||
      Date.parse(regression.issued_at) < latestReview) throw new Error('Versioned update lacks complete subsequent regression evidence');

  const permit: ValidationPermit = Object.freeze({
    candidate: structuredClone(candidate), candidate_sha256: candidateHash,
    validation_bundle_sha256: digest(bundle), trust_policy_sha256: digest(policy),
    validated_at: regression.issued_at, reviewer_ids: Object.freeze([...reviewers].sort()), regression_id: regression.dataset_id,
  });
  permits.add(permit);
  permitDigests.set(permit, digest(permit));
  return permit;
}

export function requireValidationPermit(permit: ValidationPermit | undefined, expected: {id: string; version: number; statement?: string}): asserts permit is ValidationPermit {
  if (!permit || !permits.has(permit) || permitDigests.get(permit) !== digest(permit)) throw new Error('A verified, unmodified validation permit is required');
  if (permit.candidate.id !== expected.id || permit.candidate.version !== expected.version ||
      (expected.statement !== undefined && permit.candidate.statement !== expected.statement)) throw new Error('Validation permit belongs to another knowledge claim/version');
}
