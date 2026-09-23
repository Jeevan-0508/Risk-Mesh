/**
 * The Learning Ledger (spec §27, §29). Per `docs/LEARNING_MODEL.md`: MESH has processed zero real
 * cases as of this phase, so validation/benchmark/decay content cannot honestly be built yet — that
 * would mean testing it against fabricated outcomes, exactly the self-deception §7/§58 warn against.
 * What *can* be built now, honestly, is the lifecycle itself: the same kind of pure state machine
 * `evidence-fabric.ts`/`case-engine.ts` already are, enforcing which `LessonStatus` may move to
 * which and nothing more. No transition here inspects lesson content or decides it was "correct" —
 * that judgement is exactly the runtime this phase deliberately defers.
 *
 * One exception, because it is a concrete rule quoted directly in LEARNING_MODEL.md rather than a
 * judgement call: "a lesson learned from a simulated case is PROVISIONAL forever, never promoted to
 * ADOPTED knowledge that changes live routing." That needs no benchmark or outcome data to enforce —
 * only the lesson's own `provenance.source`, already on every MESH object — so `transition()` blocks
 * CANDIDATE/VERIFIED/VALIDATED → ADOPTED whenever `provenance.source === 'SIMULATED'`.
 */
import type { Lesson, LessonStatus } from '../contracts/schemas';
import { MeshStore } from './store';
import { Ledger } from './ledger';

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
    super(`Lesson ${id} was learned from a SIMULATED case and is PROVISIONAL forever (LEARNING_MODEL.md) — it can never move to ADOPTED, only REJECTED or stay VALIDATED.`);
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

  transition(id: string, to: LessonStatus, reason: string, at: string): Lesson {
    const current = this.store.require(id);
    const allowed = ALLOWED_LESSON_TRANSITIONS[current.status];
    if (!allowed.includes(to)) throw new IllegalLessonTransitionError(current.status, to);
    if (to === 'ADOPTED' && current.provenance.source === 'SIMULATED') throw new ProvisionalLessonError(id);
    const next: Lesson = { ...current, status: to };
    this.store.replace(id, next);
    this.ledger.append({
      type: to === 'VALIDATED' ? 'LESSON_VALIDATED' : 'LESSON_STATUS_CHANGED',
      at, case_id: current.source_case_id, ref_id: id, detail: `${current.status} -> ${to}: ${reason}`,
    });
    return next;
  }
}
