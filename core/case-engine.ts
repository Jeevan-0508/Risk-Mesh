/**
 * The Case Engine (spec §4). A case never stores a copy of the record it references — only the id.
 * Reconstructing what happened means resolving those ids back out through the stores that actually
 * hold the data (`reconstruct()`), so a case can never drift out of sync with the evidence/decision/
 * replay objects it points at.
 */
import type { Case, CaseStatus } from '../contracts/schemas';
import { MeshStore } from './store';
import { Ledger } from './ledger';

const ALLOWED_CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  OPEN: ['INVESTIGATING', 'CLOSED'],
  INVESTIGATING: ['DECIDED', 'CLOSED'],
  DECIDED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['INVESTIGATING'],
};

export class IllegalCaseTransitionError extends Error {
  constructor(from: CaseStatus, to: CaseStatus) {
    super(`Case cannot move from ${from} to ${to} — allowed from ${from}: [${ALLOWED_CASE_TRANSITIONS[from].join(', ') || 'none, terminal'}].`);
  }
}

type AttachableListField = 'signal_ids' | 'behavior_ids' | 'decision_ids' | 'disagreement_ids' | 'challenge_ids' | 'replay_ids' | 'lesson_ids' | 'evidence_ids';

export class CaseEngine {
  private readonly store = new MeshStore<Case>();

  constructor(private readonly ledger: Ledger) {}

  create(caseObj: Case): Case {
    const stored = this.store.add(caseObj);
    this.ledger.append({ type: 'CASE_CREATED', at: caseObj.created_at, case_id: caseObj.id, ref_id: caseObj.id, detail: caseObj.title });
    return stored;
  }

  get(id: string): Case | undefined {
    return this.store.get(id);
  }

  list(): Case[] {
    return this.store.list();
  }

  private attach(caseId: string, field: AttachableListField, refId: string, at: string, eventType: 'DISAGREEMENT' | 'CHALLENGE' | 'REPLAY' | 'DECISION' | 'MODEL_DECISION' | 'EVIDENCE_ADDED' | 'INVESTIGATION' | 'LESSON_PROPOSED'): Case {
    const current = this.store.require(caseId);
    const existing = (current[field] ?? []) as string[];
    if (existing.includes(refId)) return current;
    const next: Case = { ...current, [field]: [...existing, refId] };
    this.store.replace(caseId, next);
    this.ledger.append({ type: eventType, at, case_id: caseId, ref_id: refId, detail: `attached to ${field}` });
    return next;
  }

  attachEvidence(caseId: string, evidenceId: string, at: string): Case {
    return this.attach(caseId, 'evidence_ids', evidenceId, at, 'EVIDENCE_ADDED');
  }

  attachDecision(caseId: string, decisionId: string, at: string): Case {
    return this.attach(caseId, 'decision_ids', decisionId, at, 'DECISION');
  }

  attachDisagreement(caseId: string, disagreementId: string, at: string): Case {
    return this.attach(caseId, 'disagreement_ids', disagreementId, at, 'DISAGREEMENT');
  }

  attachChallenge(caseId: string, challengeId: string, at: string): Case {
    return this.attach(caseId, 'challenge_ids', challengeId, at, 'CHALLENGE');
  }

  attachReplay(caseId: string, replayId: string, at: string): Case {
    return this.attach(caseId, 'replay_ids', replayId, at, 'REPLAY');
  }

  attachLesson(caseId: string, lessonId: string, at: string): Case {
    return this.attach(caseId, 'lesson_ids', lessonId, at, 'LESSON_PROPOSED');
  }

  setOutcome(caseId: string, outcomeId: string, at: string): Case {
    const current = this.store.require(caseId);
    const next: Case = { ...current, outcome_id: outcomeId };
    this.store.replace(caseId, next);
    this.ledger.append({ type: 'OUTCOME', at, case_id: caseId, ref_id: outcomeId, detail: 'outcome recorded' });
    return next;
  }

  transitionStatus(caseId: string, to: CaseStatus, at: string, reason: string): Case {
    const current = this.store.require(caseId);
    const allowed = ALLOWED_CASE_TRANSITIONS[current.status];
    if (!allowed.includes(to)) throw new IllegalCaseTransitionError(current.status, to);
    const next: Case = { ...current, status: to };
    this.store.replace(caseId, next);
    this.ledger.append({ type: 'INVESTIGATION', at, case_id: caseId, ref_id: caseId, detail: `${current.status} -> ${to}: ${reason}` });
    return next;
  }
}
