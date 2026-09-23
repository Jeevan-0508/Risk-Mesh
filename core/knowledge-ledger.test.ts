import { describe, expect, it } from 'bun:test';
import { KnowledgeLedger, IllegalKnowledgeTransitionError } from './knowledge-ledger';
import { Ledger } from './ledger';
import type { Knowledge } from '../contracts/schemas';

const AT = '2026-09-23T10:00:00.000Z';
const makeKnowledge = (overrides: Partial<Knowledge> = {}): Knowledge => ({
  id: 'know-1', schema_version: '1.0', created_at: AT, source: 'test', status: 'ACTIVE',
  provenance: { source: 'SIMULATED', system: 'test', retrieved_at: AT, upstream_ref: null, note: null },
  statement: 'Double brokering on lane X correlates with rate undercuts > 15%', version: 1,
  last_confirmed: AT, confidence: 0.7, validation_count: 1, contradiction_count: 0,
  decay_policy: 'stale after 90 days without reconfirmation',
  ...overrides,
});

describe('KnowledgeLedger', () => {
  it('record() writes a KNOWLEDGE_ADOPTED ledger event', () => {
    const ledger = new Ledger();
    const knowledge = new KnowledgeLedger(ledger);
    knowledge.record(makeKnowledge());
    expect(ledger.ofType('KNOWLEDGE_ADOPTED').length).toBe(1);
  });

  it('record() rejects a knowledge version that does not start ACTIVE', () => {
    const knowledge = new KnowledgeLedger(new Ledger());
    expect(() => knowledge.record(makeKnowledge({ status: 'STALE' }))).toThrow();
  });

  it('allows ACTIVE -> STALE -> ACTIVE (reconfirmed) and ACTIVE -> SUPERSEDED', () => {
    const knowledge = new KnowledgeLedger(new Ledger());
    knowledge.record(makeKnowledge());
    knowledge.transition('know-1', 'STALE', 'no reconfirmation in 90 days', AT);
    const reconfirmed = knowledge.transition('know-1', 'ACTIVE', 'reconfirmed by a new case', AT);
    expect(reconfirmed.status).toBe('ACTIVE');
    const superseded = knowledge.transition('know-1', 'SUPERSEDED', 'replaced by v2', AT);
    expect(superseded.status).toBe('SUPERSEDED');
  });

  it('rejects any transition out of the terminal SUPERSEDED status', () => {
    const knowledge = new KnowledgeLedger(new Ledger());
    knowledge.record(makeKnowledge());
    knowledge.transition('know-1', 'SUPERSEDED', 'replaced', AT);
    expect(() => knowledge.transition('know-1', 'ACTIVE', 'reconsidered', AT)).toThrow(IllegalKnowledgeTransitionError);
  });

  it('CONTRADICTED may only move to SUPERSEDED, never silently back to ACTIVE', () => {
    const knowledge = new KnowledgeLedger(new Ledger());
    knowledge.record(makeKnowledge());
    knowledge.transition('know-1', 'CONTRADICTED', 'a newer case directly contradicts this', AT);
    expect(() => knowledge.transition('know-1', 'ACTIVE', 'ignore the contradiction', AT)).toThrow(IllegalKnowledgeTransitionError);
    const superseded = knowledge.transition('know-1', 'SUPERSEDED', 'replaced after review', AT);
    expect(superseded.status).toBe('SUPERSEDED');
  });

  it('recordContradiction() increments contradiction_count and transitions to CONTRADICTED, as one signal never silently absorbed', () => {
    const knowledge = new KnowledgeLedger(new Ledger());
    knowledge.record(makeKnowledge({ contradiction_count: 0 }));
    const contradicted = knowledge.recordContradiction('know-1', 'FFT-002 case directly contradicts this claim', AT);
    expect(contradicted.status).toBe('CONTRADICTED');
    expect(contradicted.contradiction_count).toBe(1);
  });

  it('transition() writes a KNOWLEDGE_STATUS_CHANGED ledger event for every status change', () => {
    const ledger = new Ledger();
    const knowledge = new KnowledgeLedger(ledger);
    knowledge.record(makeKnowledge());
    knowledge.transition('know-1', 'STALE', 'no reconfirmation', AT);
    expect(ledger.ofType('KNOWLEDGE_STATUS_CHANGED').length).toBe(1);
  });
});
