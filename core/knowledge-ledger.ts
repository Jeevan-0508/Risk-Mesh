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

  record(knowledge: Knowledge): Knowledge {
    if (knowledge.status !== 'ACTIVE') {
      throw new Error(`record() requires status ACTIVE (a knowledge version starts trusted, not stale/contradicted/superseded) — got ${knowledge.status}`);
    }
    const stored = this.store.add(knowledge);
    this.ledger.append({
      type: 'KNOWLEDGE_ADOPTED', at: knowledge.created_at, case_id: knowledge.case_id ?? null,
      ref_id: knowledge.id, detail: `v${knowledge.version}: ${knowledge.statement}`,
    });
    return stored;
  }

  get(id: string): Knowledge | undefined {
    return this.store.get(id);
  }

  list(): Knowledge[] {
    return this.store.list();
  }

  transition(id: string, to: KnowledgeStatus, reason: string, at: string): Knowledge {
    const current = this.store.require(id);
    const allowed = ALLOWED_KNOWLEDGE_TRANSITIONS[current.status];
    if (!allowed.includes(to)) throw new IllegalKnowledgeTransitionError(current.status, to);
    const next: Knowledge = { ...current, status: to };
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
    const withCount: Knowledge = { ...current, contradiction_count: current.contradiction_count + 1 };
    this.store.replace(id, withCount);
    return this.transition(id, 'CONTRADICTED', reason, at);
  }
}
