import { describe, expect, it } from 'bun:test';
import { OutcomeEngine } from './outcome-engine';
import { CaseEngine } from './case-engine';
import { Ledger } from './ledger';
import type { Case, Outcome } from '../contracts/schemas';

const AT = '2026-09-23T10:00:00.000Z';
const makeCase = (overrides: Partial<Case> = {}): Case => ({
  id: 'case-1', schema_version: '1.0', created_at: AT, source: 'test', status: 'OPEN',
  provenance: { source: 'SIMULATED', system: 'test', retrieved_at: AT, upstream_ref: null, note: null },
  title: 'Missing trailer, Lane DE-12', summary: 'Trailer reported missing after handoff.',
  signal_ids: [], entity_ids: [], behavior_ids: [], decision_ids: [], disagreement_ids: [],
  challenge_ids: [], replay_ids: [], outcome_id: null, lesson_ids: [],
  ...overrides,
});
const makeOutcome = (overrides: Partial<Outcome> = {}): Outcome => ({
  id: 'out-1', schema_version: '1.0', created_at: AT, source: 'test', status: 'RECORDED',
  provenance: { source: 'SIMULATED', system: 'test', retrieved_at: AT, upstream_ref: null, note: null },
  case_id: 'case-1', decision_id: 'dec-1', observed_at: AT,
  actual_result: 'Trailer recovered intact, no fraud confirmed.', matches_prediction: true,
  ...overrides,
});

describe('OutcomeEngine', () => {
  it('record() stores the outcome and links it to its case via CaseEngine.setOutcome', () => {
    const ledger = new Ledger();
    const caseEngine = new CaseEngine(ledger);
    caseEngine.create(makeCase());
    const engine = new OutcomeEngine(ledger, caseEngine);
    const stored = engine.record(makeOutcome());
    expect(engine.get('out-1')).toEqual(stored);
    expect(caseEngine.get('case-1')?.outcome_id).toBe('out-1');
  });

  it('record() does not append a second OUTCOME ledger event on top of setOutcome\'s own', () => {
    const ledger = new Ledger();
    const caseEngine = new CaseEngine(ledger);
    caseEngine.create(makeCase());
    const engine = new OutcomeEngine(ledger, caseEngine);
    engine.record(makeOutcome());
    expect(ledger.ofType('OUTCOME').length).toBe(1);
  });

  it('list() returns every recorded outcome', () => {
    const ledger = new Ledger();
    const caseEngine = new CaseEngine(ledger);
    caseEngine.create(makeCase());
    caseEngine.create(makeCase({ id: 'case-2' }));
    const engine = new OutcomeEngine(ledger, caseEngine);
    engine.record(makeOutcome());
    engine.record(makeOutcome({ id: 'out-2', case_id: 'case-2' }));
    expect(engine.list().map((o) => o.id)).toEqual(['out-1', 'out-2']);
  });

  it('amend() moves RECORDED -> AMENDED, applies the patch, and logs a second OUTCOME event', () => {
    const ledger = new Ledger();
    const caseEngine = new CaseEngine(ledger);
    caseEngine.create(makeCase());
    const engine = new OutcomeEngine(ledger, caseEngine);
    engine.record(makeOutcome());
    const amended = engine.amend('out-1', { actual_result: 'Corrected: trailer never left the yard.' }, AT, 'initial report was wrong');
    expect(amended.status).toBe('AMENDED');
    expect(amended.actual_result).toBe('Corrected: trailer never left the yard.');
    expect(ledger.ofType('OUTCOME').length).toBe(2);
  });

  it('amend() can be applied again to an already-AMENDED outcome (a correction can itself be corrected)', () => {
    const ledger = new Ledger();
    const caseEngine = new CaseEngine(ledger);
    caseEngine.create(makeCase());
    const engine = new OutcomeEngine(ledger, caseEngine);
    engine.record(makeOutcome());
    engine.amend('out-1', { actual_result: 'first correction' }, AT, 'first fix');
    const reamended = engine.amend('out-1', { actual_result: 'second correction' }, AT, 'second fix');
    expect(reamended.status).toBe('AMENDED');
    expect(reamended.actual_result).toBe('second correction');
    expect(ledger.ofType('OUTCOME').length).toBe(3);
  });

});
