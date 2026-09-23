import { describe, expect, it } from 'bun:test';
import { EvidenceFabric, IllegalTransitionError } from './evidence-fabric';
import { Ledger } from './ledger';
import type { Evidence } from '../contracts/schemas';

const AT = '2026-09-23T10:00:00.000Z';
const makeEvidence = (overrides: Partial<Evidence> = {}): Evidence => ({
  id: 'ev-1', schema_version: '1.0', created_at: AT, source: 'test', status: 'UNVERIFIED',
  provenance: { source: 'SNAPSHOT', system: 'test', retrieved_at: AT, upstream_ref: null, note: null },
  source_type: 'news', observed_at: AT, content_hash: 'sha256:x', reliability: 0.5, independent: true,
  case_id: 'case-1',
  ...overrides,
});

describe('EvidenceFabric', () => {
  it('adding evidence writes an EVIDENCE_ADDED ledger event', () => {
    const ledger = new Ledger();
    const fabric = new EvidenceFabric(ledger);
    fabric.add(makeEvidence());
    expect(ledger.ofType('EVIDENCE_ADDED').length).toBe(1);
  });

  it('allows UNVERIFIED -> VERIFIED -> SUPERSEDED', () => {
    const fabric = new EvidenceFabric(new Ledger());
    fabric.add(makeEvidence());
    fabric.transition('ev-1', 'VERIFIED', 'corroborated by a second independent source', AT);
    const final = fabric.transition('ev-1', 'SUPERSEDED', 'newer evidence replaces this', AT);
    expect(final.status).toBe('SUPERSEDED');
  });

  it('rejects UNVERIFIED -> SUPERSEDED directly (must pass through VERIFIED or CONTRADICTED)', () => {
    const fabric = new EvidenceFabric(new Ledger());
    fabric.add(makeEvidence());
    expect(() => fabric.transition('ev-1', 'SUPERSEDED', 'skip ahead', AT)).toThrow(IllegalTransitionError);
  });

  it('rejects any transition out of a terminal status', () => {
    const fabric = new EvidenceFabric(new Ledger());
    fabric.add(makeEvidence());
    fabric.transition('ev-1', 'REJECTED', 'debunked', AT);
    expect(() => fabric.transition('ev-1', 'VERIFIED', 'reconsidered', AT)).toThrow(IllegalTransitionError);
  });

  it('list(caseId) filters by case', () => {
    const fabric = new EvidenceFabric(new Ledger());
    fabric.add(makeEvidence({ id: 'ev-1', case_id: 'case-1' }));
    fabric.add(makeEvidence({ id: 'ev-2', case_id: 'case-2' }));
    expect(fabric.list('case-1').map((e) => e.id)).toEqual(['ev-1']);
  });
});
