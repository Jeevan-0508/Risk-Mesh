/**
 * The MESH event ledger (spec §42). Append-only: there is deliberately no `update` or `delete`
 * method on this class at all, not even a private one — a correction is a new event that
 * references the one it corrects, never an edit to history.
 */
import type { IsoTimestamp } from '../contracts/schemas';

export const LEDGER_EVENT_TYPES = [
  'CASE_CREATED', 'EVIDENCE_ADDED', 'EVIDENCE_STATUS_CHANGED', 'MODEL_DECISION', 'DISAGREEMENT',
  'INVESTIGATION', 'CHALLENGE', 'REPLAY', 'DECISION', 'OUTCOME', 'LESSON_PROPOSED',
  'LESSON_VALIDATED', 'KNOWLEDGE_ADOPTED', 'MODEL_EVALUATED', 'IMPROVEMENT_PROPOSED',
  'IMPROVEMENT_APPROVED', 'IMPROVEMENT_REJECTED',
] as const;
export type LedgerEventType = typeof LEDGER_EVENT_TYPES[number];

export interface LedgerEvent {
  event_id: string;
  type: LedgerEventType;
  at: IsoTimestamp;
  case_id: string | null;
  ref_id: string | null;
  detail: string;
}

export class Ledger {
  private readonly events: LedgerEvent[] = [];
  private sequence = 0;

  append(event: Omit<LedgerEvent, 'event_id'>): LedgerEvent {
    this.sequence += 1;
    const stamped: LedgerEvent = { ...event, event_id: `evt-${this.sequence}` };
    this.events.push(stamped);
    return stamped;
  }

  list(): readonly LedgerEvent[] {
    return this.events;
  }

  forCase(caseId: string): LedgerEvent[] {
    return this.events.filter((e) => e.case_id === caseId);
  }

  ofType(type: LedgerEventType): LedgerEvent[] {
    return this.events.filter((e) => e.type === type);
  }
}
