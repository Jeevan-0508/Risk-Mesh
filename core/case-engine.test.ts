import { describe, expect, it } from 'bun:test';
import { CaseEngine, IllegalCaseTransitionError } from './case-engine';
import { Ledger } from './ledger';
import type { Case } from '../contracts/schemas';

const AT = '2026-09-23T10:00:00.000Z';
const makeCase = (overrides: Partial<Case> = {}): Case => ({
  id: 'case-1', schema_version: '1.0', created_at: AT, source: 'test', status: 'OPEN',
  provenance: { source: 'SIMULATED', system: 'test', retrieved_at: AT, upstream_ref: null, note: null },
  title: 'Missing trailer, Lane DE-12', summary: 'Trailer reported missing after handoff.',
  signal_ids: [], entity_ids: [], behavior_ids: [], decision_ids: [], disagreement_ids: [],
  challenge_ids: [], replay_ids: [], outcome_id: null, lesson_ids: [],
  ...overrides,
});

describe('CaseEngine', () => {
  it('create() writes a CASE_CREATED ledger event', () => {
    const ledger = new Ledger();
    const engine = new CaseEngine(ledger);
    engine.create(makeCase());
    expect(ledger.ofType('CASE_CREATED').length).toBe(1);
  });

  it('attachEvidence is idempotent and stores only the id, never a copy', () => {
    const engine = new CaseEngine(new Ledger());
    engine.create(makeCase());
    engine.attachEvidence('case-1', 'ev-1', AT);
    const after = engine.attachEvidence('case-1', 'ev-1', AT);
    expect(after.evidence_ids).toEqual(['ev-1']);
  });

  it('attachDecision, attachDisagreement, attachChallenge, attachReplay, attachLesson each append to their own list', () => {
    const engine = new CaseEngine(new Ledger());
    engine.create(makeCase());
    engine.attachDecision('case-1', 'dec-1', AT);
    engine.attachDisagreement('case-1', 'dis-1', AT);
    engine.attachChallenge('case-1', 'chal-1', AT);
    engine.attachReplay('case-1', 'rep-1', AT);
    const withLesson = engine.attachLesson('case-1', 'les-1', AT);
    expect(withLesson.decision_ids).toEqual(['dec-1']);
    expect(withLesson.disagreement_ids).toEqual(['dis-1']);
    expect(withLesson.challenge_ids).toEqual(['chal-1']);
    expect(withLesson.replay_ids).toEqual(['rep-1']);
    expect(withLesson.lesson_ids).toEqual(['les-1']);
  });

  it('setOutcome sets outcome_id and logs an OUTCOME event', () => {
    const ledger = new Ledger();
    const engine = new CaseEngine(ledger);
    engine.create(makeCase());
    const withOutcome = engine.setOutcome('case-1', 'out-1', AT);
    expect(withOutcome.outcome_id).toBe('out-1');
    expect(ledger.ofType('OUTCOME').length).toBe(1);
  });

  it('follows the real lifecycle OPEN -> INVESTIGATING -> DECIDED -> CLOSED', () => {
    const engine = new CaseEngine(new Ledger());
    engine.create(makeCase());
    engine.transitionStatus('case-1', 'INVESTIGATING', AT, 'evidence gathering begins');
    engine.transitionStatus('case-1', 'DECIDED', AT, 'arbiter reached ACCEPT');
    const closed = engine.transitionStatus('case-1', 'CLOSED', AT, 'no further action');
    expect(closed.status).toBe('CLOSED');
  });

  it('rejects OPEN -> DECIDED directly (must pass through INVESTIGATING)', () => {
    const engine = new CaseEngine(new Ledger());
    engine.create(makeCase());
    expect(() => engine.transitionStatus('case-1', 'DECIDED', AT, 'skip ahead')).toThrow(IllegalCaseTransitionError);
  });

  it('a CLOSED case can be REOPENED, but a REOPENED case must go back through INVESTIGATING', () => {
    const engine = new CaseEngine(new Ledger());
    engine.create(makeCase());
    engine.transitionStatus('case-1', 'INVESTIGATING', AT, 'x');
    engine.transitionStatus('case-1', 'DECIDED', AT, 'x');
    engine.transitionStatus('case-1', 'CLOSED', AT, 'x');
    const reopened = engine.transitionStatus('case-1', 'REOPENED', AT, 'new evidence surfaced');
    expect(reopened.status).toBe('REOPENED');
    expect(() => engine.transitionStatus('case-1', 'DECIDED', AT, 'skip ahead again')).toThrow(IllegalCaseTransitionError);
  });
});
