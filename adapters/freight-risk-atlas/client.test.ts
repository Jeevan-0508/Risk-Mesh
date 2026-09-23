import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { readTaxonomySnapshot } from './client';

const DIR = join(import.meta.dir, '../_shared/__fixtures__');

describe('readTaxonomySnapshot', () => {
  it('reads real meta + the 2 trimmed patterns from the hash-verified fixture', async () => {
    const result = await readTaxonomySnapshot(DIR);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.status).toBe('SNAPSHOT');
    expect(result.meta.version).toBe('1.0.0');
    expect(result.meta.pattern_count).toBe(12);
    expect(result.patterns).toHaveLength(2);
    expect(result.patterns[0]?.id).toBe('FFT-001');
    expect(result.patterns[1]?.id).toBe('FFT-002');
    expect(result.commit).toBe('fc1a66dc387bdd410eeaaf55220882097eeaef0b');
    expect(result.sha256).toBe('7b10df55856a97dcc1a8bc516cca064b4e330e765878a7344729140a165bfdfd');
  });

  it('fails closed, never fabricating a taxonomy, when the snapshot dir has no provenance.json', async () => {
    const result = await readTaxonomySnapshot(join(import.meta.dir, 'does-not-exist'));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe('UNAVAILABLE');
  });
});
