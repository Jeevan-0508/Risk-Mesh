import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { readFomoSnapshot } from './client';

const DIR = join(import.meta.dir, '../_shared/__fixtures__');

describe('readFomoSnapshot', () => {
  it('reads all 5 real trimmed signals from the hash-verified fixture', async () => {
    const result = await readFomoSnapshot(DIR);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.status).toBe('SNAPSHOT');
    expect(result.signals).toHaveLength(5);
    expect(result.signals[0]?.category).toBe('Corporate Insolvency');
    expect(result.signals[0]?.source).toBe('Trans.INFO');
    expect(result.commit).toBe('451c5c989df259553e0acc9f041dea274e929857');
  });

  it('fails closed, never fabricating signals, when the snapshot dir has no provenance.json', async () => {
    const result = await readFomoSnapshot(join(import.meta.dir, 'does-not-exist'));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe('UNAVAILABLE');
  });

  it('fails closed on a hash mismatch rather than trusting a tampered signals.json', async () => {
    const mismatchDir = join(import.meta.dir, '../_shared/__fixtures__/mismatch-dir');
    const result = await readFomoSnapshot(mismatchDir);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error).toContain('hash mismatch');
  });
});
