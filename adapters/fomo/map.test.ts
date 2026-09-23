import { describe, expect, it } from 'bun:test';
import { fomoSignalToMeshSignal } from './map';
import type { FomoSignal } from './client';

const SIGNAL: FomoSignal = {
  category: 'Corporate Insolvency',
  title: 'Betz insolvency exposes structural weaknesses in Germany\u2019s transport market - Trans.INFO',
  link: 'https://example.com/article',
  source: 'Trans.INFO',
  pub_date: 'Fri, 10 Apr 2026 07:00:00 GMT',
  severity: 'medium',
  found_at: '2026-09-03T12:54:42.455900+00:00',
};

describe('fomoSignalToMeshSignal', () => {
  it('maps every field into the MESH Signal contract, always as RAW and external', () => {
    const mapped = fomoSignalToMeshSignal(SIGNAL, { observedAt: '2026-09-23T00:00:00.000Z', commit: '451c5c989df259553e0acc9f041dea274e929857', index: 0 });

    expect(mapped.status).toBe('RAW');
    expect(mapped.external).toBe(true);
    expect(mapped.signal_type).toBe('Corporate Insolvency');
    expect(mapped.payload).toEqual(SIGNAL as unknown as Record<string, unknown>);
    expect(mapped.provenance.source).toBe('SNAPSHOT');
    expect(mapped.provenance.system).toBe('fomo');
    expect(mapped.provenance.upstream_ref).toBe('451c5c989df259553e0acc9f041dea274e929857');
    expect(mapped.id).toBe('fomo-signal-451c5c9-0');
    expect(mapped.created_at).toBe('2026-09-23T00:00:00.000Z');
  });

  it('never promotes to evidence itself — status is always RAW regardless of severity', () => {
    const high = fomoSignalToMeshSignal({ ...SIGNAL, severity: 'high' }, { observedAt: '2026-09-23T00:00:00.000Z', commit: 'abc', index: 1 });
    expect(high.status).toBe('RAW');
  });

  it('derives distinct ids from the index, so multiple signals in one commit never collide', () => {
    const first = fomoSignalToMeshSignal(SIGNAL, { observedAt: '2026-09-23T00:00:00.000Z', commit: 'abc1234', index: 0 });
    const second = fomoSignalToMeshSignal(SIGNAL, { observedAt: '2026-09-23T00:00:00.000Z', commit: 'abc1234', index: 1 });
    expect(first.id).not.toBe(second.id);
  });
});
