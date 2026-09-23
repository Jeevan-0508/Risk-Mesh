import { describe, expect, it } from 'bun:test';
import { Ledger } from './ledger';

describe('Ledger', () => {
  it('has no update or delete method — append-only really means it', () => {
    const ledger = new Ledger();
    expect((ledger as unknown as { update?: unknown }).update).toBeUndefined();
    expect((ledger as unknown as { delete?: unknown }).delete).toBeUndefined();
  });

  it('assigns sequential event ids and preserves append order', () => {
    const ledger = new Ledger();
    const e1 = ledger.append({ type: 'CASE_CREATED', at: '2026-09-23T10:00:00.000Z', case_id: 'c1', ref_id: 'c1', detail: 'x' });
    const e2 = ledger.append({ type: 'EVIDENCE_ADDED', at: '2026-09-23T10:01:00.000Z', case_id: 'c1', ref_id: 'e1', detail: 'y' });
    expect(ledger.list().map((e) => e.event_id)).toEqual([e1.event_id, e2.event_id]);
  });

  it('forCase and ofType filter correctly', () => {
    const ledger = new Ledger();
    ledger.append({ type: 'CASE_CREATED', at: '2026-09-23T10:00:00.000Z', case_id: 'c1', ref_id: 'c1', detail: 'x' });
    ledger.append({ type: 'CASE_CREATED', at: '2026-09-23T10:00:00.000Z', case_id: 'c2', ref_id: 'c2', detail: 'y' });
    expect(ledger.forCase('c1').length).toBe(1);
    expect(ledger.ofType('CASE_CREATED').length).toBe(2);
  });
});
