import { describe, expect, it } from 'bun:test';
import { mapClassification, moRecordToBehavior } from './map';
import type { FraudWatchMoRecord } from './client';
import worldStateFixture from './__fixtures__/world-state.mos.json';

const AT = '2026-09-23T10:00:00.000Z';
const PATH = 'fraud-watch/data/world-state.json';

// Real captured MO records — see __fixtures__/PROVENANCE.md.
const realRecords = (worldStateFixture as { moEngine: { mos: [string, FraudWatchMoRecord][] } }).moEngine.mos.map(([, record]) => record);
const [mo1] = realRecords;

describe('mapClassification', () => {
  it('maps the three fraud-watch classifications that mean the same fact MESH names', () => {
    expect(mapClassification('KNOWN_MO')).toEqual({ ok: true, kind: 'KNOWN_MO' });
    expect(mapClassification('MO_VARIANT')).toEqual({ ok: true, kind: 'MO_VARIANT' });
    expect(mapClassification('EMERGING_BEHAVIOR')).toEqual({ ok: true, kind: 'EMERGING_BEHAVIOR' });
  });

  it('maps POTENTIAL_NEW_MO to EDGE_CASE, not to CANDIDATE_NEW_MO, honouring fraud-watch\'s own definition', () => {
    const result = mapClassification('POTENTIAL_NEW_MO');
    expect(result).toEqual({ ok: true, kind: 'EDGE_CASE' });
  });

  it('refuses to guess a mapping for a classification fraud-watch does not actually issue', () => {
    const result = mapClassification('SOMETHING_FRAUD_WATCH_NEVER_ISSUES');
    expect(result.ok).toBe(false);
  });

  it('never maps the FALSE_POSITIVE status string as if it were a classification', () => {
    // FALSE_POSITIVE is a real fraud-watch string, but only as a value of `status`, never of
    // `classification` — this map only ever accepts classification strings, so it must reject it.
    const result = mapClassification('FALSE_POSITIVE');
    expect(result.ok).toBe(false);
  });
});

describe('moRecordToBehavior', () => {
  it('maps a real captured MO record to a Behavior that is unconditionally simulated (spec §16)', () => {
    if (!mo1) throw new Error('fixture has no MO records');
    const result = moRecordToBehavior(mo1, 'case-1', AT, PATH);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.behavior.simulated).toBe(true);
    expect(result.behavior.status).toBe('SIMULATED');
    expect(result.behavior.kind).toBe('EMERGING_BEHAVIOR');
    expect(result.behavior.provenance.source).toBe('SIMULATED');
    expect(result.behavior.provenance.system).toBe('fraud-watch');
    expect(result.behavior.description).toContain(mo1.signature);
  });

  it('carries fraud-watch\'s own investigation status into provenance.note, never into Behavior.status', () => {
    if (!mo1) throw new Error('fixture has no MO records');
    const result = moRecordToBehavior(mo1, 'case-1', AT, PATH);
    if (!result.ok) throw new Error('unreachable');
    expect(result.behavior.status).toBe('SIMULATED');
    expect(result.behavior.provenance.note).toContain(`status=${mo1.status}`);
  });

  it('propagates an unmapped classification as a failure rather than a guessed Behavior', () => {
    if (!mo1) throw new Error('fixture has no MO records');
    const unmapped: FraudWatchMoRecord = { ...mo1, classification: 'NOT_A_REAL_CLASS' };
    const result = moRecordToBehavior(unmapped, 'case-1', AT, PATH);
    expect(result.ok).toBe(false);
  });
});
