/** Synthetic lessons remain provisional. Real-world validation requires configured independent
 * signed human review and a subsequent regression receipt; model agreement is insufficient. */
import type { Lesson, LessonStatus } from '../contracts/schemas';
import { MeshStore } from './store';
import { Ledger } from './ledger';
import { requireValidationPermit, type ValidationPermit } from './controlled-validation';

const ALLOWED_LESSON_TRANSITIONS: Record<LessonStatus, LessonStatus[]> = {
  CANDIDATE: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['VALIDATED', 'REJECTED'],
  VALIDATED: ['ADOPTED', 'REJECTED'],
  ADOPTED: ['SUPERSEDED', 'DECAYED'],
  SUPERSEDED: [],
  REJECTED: [],
  DECAYED: [],
};

export class IllegalLessonTransitionError extends Error {
  constructor(from: LessonStatus, to: LessonStatus) {
    super(`Lesson cannot move from ${from} to ${to} — allowed from ${from}: [${ALLOWED_LESSON_TRANSITIONS[from].join(', ') || 'none, terminal'}].`);
  }
}

export class ProvisionalLessonError extends Error {
  constructor(id: string) {
    super(`Lesson ${id} has synthetic, mocked or unavailable provenance and remains provisional; VALIDATED and ADOPTED are prohibited.`);
  }
}

export class LearningLedger {
  private readonly store = new MeshStore<Lesson>();

  constructor(private readonly ledger: Ledger) {}

  propose(lesson: Lesson): Lesson {
    if (lesson.status !== 'CANDIDATE') {
      throw new Error(`propose() requires status CANDIDATE (spec §27: every lesson starts as a candidate) — got ${lesson.status}`);
    }
    const stored = this.store.add(lesson);
    this.ledger.append({
      type: 'LESSON_PROPOSED', at: lesson.created_at, case_id: lesson.source_case_id,
      ref_id: lesson.id, detail: `error_type=${lesson.error_type}, root_cause=${lesson.root_cause}`,
    });
    return stored;
  }

  get(id: string): Lesson | undefined {
    return this.store.get(id);
  }

  list(caseId?: string): Lesson[] {
    const all = this.store.list();
    return caseId ? all.filter((l) => l.source_case_id === caseId) : all;
  }

  transition(id: string, to: LessonStatus, reason: string, at: string, permit?: ValidationPermit): Lesson {
    const current = this.store.require(id);
    if ((to === 'VALIDATED' || to === 'ADOPTED') && ['SIMULATED', 'MOCKED', 'UNAVAILABLE'].includes(current.provenance.source)) throw new ProvisionalLessonError(id);
    const allowed = ALLOWED_LESSON_TRANSITIONS[current.status];
    if (!allowed.includes(to)) throw new IllegalLessonTransitionError(current.status, to);
    if (to === 'VALIDATED' || to === 'ADOPTED') {
      requireValidationPermit(permit, { id: current.id, version: current.version, statement: current.root_cause });
    }
    const next: Lesson = { ...current, status: to };
    this.store.replace(id, next);
    this.ledger.append({
      type: to === 'VALIDATED' ? 'LESSON_VALIDATED' : 'LESSON_STATUS_CHANGED',
      at, case_id: current.source_case_id, ref_id: id, detail: `${current.status} -> ${to}: ${reason}`,
    });
    return next;
  }
}
