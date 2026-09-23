/**
 * The Evidence Fabric (spec §5). Evidence enters only through `add()` — there is no path from a
 * model output straight into this store; whatever calls `add()` is responsible for having already
 * decided this is evidence, not a hypothesis (§5: "MODEL OUTPUT → HYPOTHESIS / DECISION", never
 * "MODEL OUTPUT → EVIDENCE" automatically). `transition()` enforces the status machine so nothing
 * can jump straight from UNVERIFIED to SUPERSEDED or leave a terminal state.
 */
import type { Evidence, EvidenceStatus } from '../contracts/schemas';
import { MeshStore } from './store';
import { Ledger } from './ledger';

const ALLOWED_TRANSITIONS: Record<EvidenceStatus, EvidenceStatus[]> = {
  UNVERIFIED: ['VERIFIED', 'CONTRADICTED', 'REJECTED'],
  VERIFIED: ['CONTRADICTED', 'SUPERSEDED'],
  CONTRADICTED: ['SUPERSEDED', 'REJECTED'],
  SUPERSEDED: [],
  REJECTED: [],
};

export class IllegalTransitionError extends Error {
  constructor(from: EvidenceStatus, to: EvidenceStatus) {
    super(`Evidence cannot move from ${from} to ${to} — allowed from ${from}: [${ALLOWED_TRANSITIONS[from].join(', ') || 'none, terminal'}].`);
  }
}

export class EvidenceFabric {
  private readonly store = new MeshStore<Evidence>();

  constructor(private readonly ledger: Ledger) {}

  add(evidence: Evidence): Evidence {
    const stored = this.store.add(evidence);
    this.ledger.append({
      type: 'EVIDENCE_ADDED', at: evidence.created_at, case_id: evidence.case_id ?? null,
      ref_id: evidence.id, detail: `${evidence.source_type} evidence added, status=${evidence.status}, provenance=${evidence.provenance.source}`,
    });
    return stored;
  }

  get(id: string): Evidence | undefined {
    return this.store.get(id);
  }

  list(caseId?: string): Evidence[] {
    const all = this.store.list();
    return caseId ? all.filter((e) => e.case_id === caseId) : all;
  }

  transition(id: string, to: EvidenceStatus, reason: string, at: string): Evidence {
    const current = this.store.require(id);
    const allowed = ALLOWED_TRANSITIONS[current.status];
    if (!allowed.includes(to)) throw new IllegalTransitionError(current.status, to);
    const next: Evidence = { ...current, status: to };
    this.store.replace(id, next);
    this.ledger.append({
      type: 'EVIDENCE_STATUS_CHANGED', at, case_id: current.case_id ?? null,
      ref_id: id, detail: `${current.status} -> ${to}: ${reason}`,
    });
    return next;
  }
}
