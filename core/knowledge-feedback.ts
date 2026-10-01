import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, readdirSync, statSync, rmSync, rmdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { KnowledgeCandidate } from '../contracts/knowledge-validation';
import { canonicalJson, digest, parseBoundedJson, sha256, verifyKnowledgeValidation, versionedUpdate } from './controlled-validation';
import { KnowledgeLedger } from './knowledge-ledger';
import { Ledger } from './ledger';
// Browser validators are dependency-free and also run in the CLI.
// @ts-ignore JavaScript contract module
import { validateRiskReplayHandoff } from '../observatory/ask-mesh.js';
// @ts-ignore JavaScript contract module
import { validateKnowledgeReviewProposal } from '../observatory/knowledge-review-proposal.js';

export function readBoundedJson(path: string): unknown {
  if (statSync(path).size > 2_000_000) throw new Error('JSON exceeds 2 MB');
  return parseBoundedJson(readFileSync(path, 'utf8'));
}

/** An operator-authored proposal becomes a review candidate, never automatically knowledge. */
export function candidateFromProposal(handoff: unknown, proposal: unknown, input: {
  id: string; author_id: string; created_at: string; target: KnowledgeCandidate['target'];
  version?: number; previous_version?: number | null;
}): KnowledgeCandidate {
  if (!validateRiskReplayHandoff(handoff).ok || !validateKnowledgeReviewProposal(proposal, handoff).ok) throw new Error('Proposal does not bind to a valid original handoff');
  // Runtime checked above; only the small named contract fields are consumed.
  const h = handoff as any; const p = proposal as any;
  const records = h.capture.research.source_records as any[];
  const references = p.proposal.evidence_references as { evidence_id: string; relationship: string }[];
  const used = new Set(references.map(r => r.evidence_id));
  const evidence = records.filter(r => used.has(r.evidence_id)).map(r => {
    const content = r.excerpt || r.title;
    let fnv = 0x811c9dc5;
    for (let i = 0; i < content.length; i++) { fnv ^= content.charCodeAt(i); fnv = Math.imul(fnv, 0x01000193) >>> 0; }
    const reportedHash = r.content_hash_algorithm === 'sha256' ? sha256(content) : `fnv1a:${fnv.toString(16).padStart(8, '0')}`;
    if (reportedHash !== r.content_hash) throw new Error('Source fingerprint does not match its exported content');
    return { id: r.evidence_id, data_class: 'external_source_content', repository: h.capture.source.repository,
      source_uri: r.url, source_revision: h.capture.source.revision, retrieved_at: r.retrieved_at,
      content, content_sha256: sha256(content), extraction_method: 'provider_excerpt' };
  });
  return KnowledgeCandidate.parse({
    schema_version: 'mesh-knowledge-candidate.v1', id: input.id, version: input.version ?? 1,
    previous_version: input.previous_version ?? null, created_at: input.created_at, author_id: input.author_id,
    statement: p.proposal.statement, scope: 'real_world', case_id: h.capture.research.run_id,
    source_handoff_sha256: digest(handoff), hypothesis_context_sha256: h.capture.hypothesis_context ? digest(h.capture.hypothesis_context) : null,
    evidence, supporting_evidence_ids: references.filter(r => r.relationship === 'supports').map(r => r.evidence_id),
    contradicting_evidence_ids: references.filter(r => r.relationship === 'contradicts').map(r => r.evidence_id),
    unresolved_questions: p.proposal.assessment === 'insufficient' ? ['Evidence is insufficient.'] : [], target: input.target,
  });
}

/** Explicit local promotion: append a new version package, never edit taxonomy or production code.
 * Submitted bundles cannot install their own trust policy. Caller supplies operator configuration.
 * Package history is hash-linked and original signed bundles remain available for re-verification.
 */
export function promoteKnowledge(bundle: unknown, trustedPolicy: unknown, directory: string, at: string) {
  const permit = verifyKnowledgeValidation(bundle, trustedPolicy, at);
  const root = resolve(directory); mkdirSync(root, { recursive: true });
  const lock = join(root, '.promotion-lock'); mkdirSync(lock); // exclusive process lock
  let pending: string | undefined;
  try {
    const candidate = permit.candidate;
    const key = sha256(candidate.id); // IDs cannot escape the configured output directory.
    const history = readdirSync(root).filter(name => name.startsWith(key + '-v') && name.endsWith('.json'));
    const previous = history.map(name => readBoundedJson(join(root, name)) as any).sort((a, b) => a.knowledge.version - b.knowledge.version);
    let priorHash: string | null = null;
    for (let i = 0; i < previous.length; i++) {
      const item = previous[i]; const { package_sha256, ...unsigned } = item;
      if (digest(unsigned) !== package_sha256 || item.previous_package_sha256 !== priorHash || item.knowledge.id !== candidate.id || item.knowledge.version !== i + 1) throw new Error('Knowledge history integrity/version mismatch');
      // A local hash alone is not an approval; reverify original signatures against operator trust.
      const oldPermit = verifyKnowledgeValidation(item.validation_bundle, trustedPolicy, item.verified_at);
      const expected = new KnowledgeLedger(new Ledger()).recordApproved(oldPermit);
      if (digest(item.knowledge) !== digest(expected) || digest(item.versioned_update) !== digest(versionedUpdate(oldPermit.candidate))) throw new Error('Stored knowledge is not bound to its signed validation');
      priorHash = package_sha256;
    }
    if (candidate.version !== previous.length + 1 || candidate.previous_version !== (previous.length || null)) throw new Error('Version already exists or predecessor is missing');
    const ledger = new Ledger(); const knowledge = new KnowledgeLedger(ledger).recordApproved(permit);
    const payload = { schema_version: 'mesh-approved-knowledge-package.v1', verified_at: at,
      knowledge, versioned_update: versionedUpdate(candidate), validation_bundle: bundle,
      trust_policy_sha256: permit.trust_policy_sha256, previous_package_sha256: priorHash,
      audit: ledger.list(), application: 'local_knowledge_only_repository_update_requires_review' };
    const result = { ...payload, package_sha256: digest(payload) };
    const destination = join(root, `${key}-v${candidate.version}.json`);
    if (existsSync(destination)) throw new Error('Knowledge version already exists');
    pending = join(lock, 'pending.json');
    writeFileSync(pending, canonicalJson(result) + '\n', { flag: 'wx', mode: 0o600 });
    renameSync(pending, destination); pending = undefined;
    return { path: destination, package: result };
  } finally {
    if (pending && existsSync(pending)) rmSync(pending);
    rmdirSync(lock);
  }
}
