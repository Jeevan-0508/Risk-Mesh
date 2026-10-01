/**
 * Phase 13 (spec §28, §51). Unlike Lesson's transitions, which `docs/LEARNING_MODEL.md` states as
 * an explicit diagram, no equivalent diagram for `KnowledgeStatus` exists anywhere in this repo —
 * the spec text for §28/§51 is not available in this environment. The transition table below is
 * therefore explicitly ASSUMED, not spec-quoted, following the same honesty convention
 * `trust-engine.ts` already uses for its unmeasured thresholds. It is modelled on the structurally
 * closest existing precedent, `evidence-fabric.ts`'s own status machine (ACTIVE ~ UNVERIFIED's
 * "currently trusted" role, CONTRADICTED and SUPERSEDED map directly by name): a fact can go stale,
 * be contradicted, or be superseded by a newer version, but once superseded it is terminal, and
 * once contradicted it may only be superseded (never silently trusted again without a new version).
 * Revisit this table if the real spec text becomes available.
 */
import type { Knowledge, KnowledgeStatus } from '../contracts/schemas';
import { MeshStore } from './store';
import { Ledger } from './ledger';
import { requireValidationPermit, type ValidationPermit } from './controlled-validation';

const ALLOWED_KNOWLEDGE_TRANSITIONS: Record<KnowledgeStatus, KnowledgeStatus[]> = {
  ACTIVE: ['STALE', 'CONTRADICTED', 'SUPERSEDED'],
  STALE: ['ACTIVE', 'CONTRADICTED', 'SUPERSEDED'],
  CONTRADICTED: ['SUPERSEDED'],
  SUPERSEDED: [],
};

export class IllegalKnowledgeTransitionError extends Error {
  constructor(from: KnowledgeStatus, to: KnowledgeStatus) {
    super(`Knowledge cannot move from ${from} to ${to} — allowed from ${from}: [${ALLOWED_KNOWLEDGE_TRANSITIONS[from].join(', ') || 'none, terminal'}].`);
  }
}

export class KnowledgeLedger {
  private readonly store = new MeshStore<Knowledge>();

  constructor(private readonly ledger: Ledger) {}

  record(knowledge: Knowledge, permit?: ValidationPermit): Knowledge {
    requireValidationPermit(permit, knowledge);
    if (knowledge.provenance.source === 'SIMULATED' || knowledge.provenance.source === 'MOCKED' || knowledge.provenance.source === 'UNAVAILABLE') {
      throw new Error('Synthetic, mocked or unavailable provenance cannot become active real-world knowledge');
    }
    if (knowledge.confidence !== null) throw new Error('No calibrated probability is available from human review; confidence must be null');
    if (knowledge.status !== 'ACTIVE') {
      throw new Error(`record() requires status ACTIVE (a knowledge version starts trusted, not stale/contradicted/superseded) — got ${knowledge.status}`);
    }
    const stored = this.store.add({ ...knowledge,
      last_confirmed: permit.validated_at,
      validation_count: permit.reviewer_ids.length,
      evidence_ids: [...permit.candidate.supporting_evidence_ids],
      source: 'mesh-controlled-review',
      provenance: { source: 'SNAPSHOT', system: 'mesh-controlled-review', retrieved_at: permit.validated_at,
        upstream_ref: permit.validation_bundle_sha256,
        note: 'Approved under the configured human-review policy; not a proof of empirical truth or a calibrated probability.' },
    });
    this.ledger.append({
      type: 'KNOWLEDGE_ADOPTED', at: knowledge.created_at, case_id: knowledge.case_id ?? null,
      ref_id: knowledge.id, detail: `v${knowledge.version}: ${knowledge.statement}; validation=${permit.validation_bundle_sha256}; policy=${permit.trust_policy_sha256}; reviewers=${permit.reviewer_ids.join(',')}`,
    });
    return stored;
  }

  get(id: string): Knowledge | undefined {
    return this.store.get(id);
  }

  recordApproved(permit: ValidationPermit): Knowledge {
    const candidate = permit.candidate;
    return this.record({
      id: candidate.id, schema_version: '1.0', created_at: permit.validated_at, case_id: candidate.case_id,
      source: 'mesh-controlled-review', status: 'ACTIVE',
      provenance: { source: 'SNAPSHOT', system: 'mesh-controlled-review', retrieved_at: permit.validated_at, upstream_ref: permit.validation_bundle_sha256, note: null },
      statement: candidate.statement, version: candidate.version, last_confirmed: permit.validated_at,
      confidence: null, validation_count: permit.reviewer_ids.length, contradiction_count: 0,
      decay_policy: 'Re-review when supporting sources change or contradict the statement; expiry is enforced by the configured review policy.',
    }, permit);
  }

  list(): Knowledge[] {
    return this.store.list();
  }

  transition(id: string, to: KnowledgeStatus, reason: string, at: string, permit?: ValidationPermit): Knowledge {
    const current = this.store.require(id);
    const allowed = ALLOWED_KNOWLEDGE_TRANSITIONS[current.status];
    if (!allowed.includes(to)) throw new IllegalKnowledgeTransitionError(current.status, to);
    if (to === 'ACTIVE') {
      requireValidationPermit(permit, current);
      if (Date.parse(permit.validated_at) <= Date.parse(current.last_confirmed)) throw new Error('Reconfirmation requires a newer validation');
    }
    const next: Knowledge = { ...current, status: to, last_confirmed: to === 'ACTIVE' ? permit!.validated_at : current.last_confirmed };
    this.store.replace(id, next);
    this.ledger.append({
      type: 'KNOWLEDGE_STATUS_CHANGED', at, case_id: current.case_id ?? null,
      ref_id: id, detail: `${current.status} -> ${to}: ${reason}`,
    });
    return next;
  }

  /** A contradiction is a signal, never quietly absorbed (mirrors §11's rule for Disagreement). */
  recordContradiction(id: string, reason: string, at: string): Knowledge {
    const current = this.store.require(id);
    if (!ALLOWED_KNOWLEDGE_TRANSITIONS[current.status].includes('CONTRADICTED')) throw new IllegalKnowledgeTransitionError(current.status, 'CONTRADICTED');
    const withCount: Knowledge = { ...current, contradiction_count: current.contradiction_count + 1 };
    this.store.replace(id, withCount);
    return this.transition(id, 'CONTRADICTED', reason, at);
  }
}
