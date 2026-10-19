import type { OlympusEvent } from './olympus-pipeline';

export type EventDeliveryStatus = 'QUEUED' | 'DELIVERED' | 'DEAD_LETTER';

export interface EventDeliveryRecord {
  event: OlympusEvent;
  status: EventDeliveryStatus;
  attempts: number;
  lastError: string | null;
}

/**
 * In-memory reference semantics for durable delivery: idempotency, bounded retries and a
 * dead-letter state. A database/queue adapter can persist these records later without changing
 * the contract or the failure behavior.
 */
export class OlympusEventQueue {
  private readonly records = new Map<string, EventDeliveryRecord>();

  constructor(private readonly maxAttempts = 3) {
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error('maxAttempts must be a positive integer');
  }

  enqueue(event: OlympusEvent): EventDeliveryRecord {
    const existing = this.records.get(event.id);
    if (existing) return existing;
    const record: EventDeliveryRecord = { event, status: 'QUEUED', attempts: 0, lastError: null };
    this.records.set(event.id, record);
    return record;
  }

  deliver(eventId: string, handler: (event: OlympusEvent) => void): EventDeliveryRecord {
    const record = this.require(eventId);
    if (record.status !== 'QUEUED') return record;
    record.attempts += 1;
    try {
      handler(record.event);
      record.status = 'DELIVERED';
      record.lastError = null;
    } catch (error) {
      record.lastError = error instanceof Error ? error.message : String(error);
      if (record.attempts >= this.maxAttempts) record.status = 'DEAD_LETTER';
    }
    return record;
  }

  retry(eventId: string, handler: (event: OlympusEvent) => void): EventDeliveryRecord {
    const record = this.require(eventId);
    if (record.status === 'DEAD_LETTER') throw new Error(`event ${eventId} is in the dead-letter queue and needs explicit requeue`);
    return this.deliver(eventId, handler);
  }

  requeue(eventId: string): EventDeliveryRecord {
    const record = this.require(eventId);
    if (record.status !== 'DEAD_LETTER') return record;
    record.status = 'QUEUED';
    record.lastError = null;
    return record;
  }

  list(): EventDeliveryRecord[] {
    return [...this.records.values()];
  }

  deadLetters(): EventDeliveryRecord[] {
    return this.list().filter((record) => record.status === 'DEAD_LETTER');
  }

  private require(eventId: string): EventDeliveryRecord {
    const record = this.records.get(eventId);
    if (!record) throw new Error(`event ${eventId} is not queued`);
    return record;
  }
}

