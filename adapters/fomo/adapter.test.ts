import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { assessFomoSignals } from './adapter';

const DIR = join(import.meta.dir, '../_shared/__fixtures__');

describe('assessFomoSignals', () => {
  it('composes client + map into 5 valid MESH signals from the real fixture', async () => {
    const result = await assessFomoSignals(DIR, '2026-09-23T00:00:00.000Z');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.signals).toHaveLength(5);
    expect(result.signals.every((s) => s.status === 'RAW' && s.external === true)).toBe(true);
    expect(new Set(result.signals.map((s) => s.id)).size).toBe(5);
  });

  it('returns ok:false with a reason, never a fabricated signal list, when the snapshot is unavailable', async () => {
    const result = await assessFomoSignals(join(import.meta.dir, 'does-not-exist'));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toContain('UNAVAILABLE');
  });
});
