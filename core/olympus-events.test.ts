import { describe, expect, it } from 'bun:test';
import { OlympusEventQueue } from './olympus-events';
import type { OlympusEvent } from './olympus-pipeline';

const event: OlympusEvent = { id: 'evt-1', type: 'AUDIT_RECORDED', correlationId: 'corr-1', at: '2026-10-19T12:00:00.000Z', payload: {}, attempt: 1 };

describe('Olympus event delivery', () => {
  it('is idempotent and delivers an event once', () => {
    const queue = new OlympusEventQueue();
    const first = queue.enqueue(event);
    const duplicate = queue.enqueue(event);
    expect(duplicate).toBe(first);
    let delivered = 0;
    queue.deliver(event.id, () => { delivered += 1; });
    queue.deliver(event.id, () => { delivered += 1; });
    expect(delivered).toBe(1);
    expect(queue.list()[0]).toMatchObject({ status: 'DELIVERED', attempts: 1 });
  });

  it('bounds retries, exposes dead letters and supports explicit requeue', () => {
    const queue = new OlympusEventQueue(2);
    queue.enqueue(event);
    queue.deliver(event.id, () => { throw new Error('temporary outage'); });
    queue.retry(event.id, () => { throw new Error('still unavailable'); });
    expect(queue.deadLetters()).toHaveLength(1);
    expect(() => queue.retry(event.id, () => undefined)).toThrow('dead-letter');
    queue.requeue(event.id);
    const delivered = queue.deliver(event.id, () => undefined);
    expect(delivered.status).toBe('DELIVERED');
    expect(delivered.attempts).toBe(3);
  });
});

