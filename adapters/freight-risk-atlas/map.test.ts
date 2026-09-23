import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { readTaxonomySnapshot } from './client';
import { findPatternById, findPatternsByCategory, summarizeMeta, taxonomyVersionRecord } from './map';

const DIR = join(import.meta.dir, '../_shared/__fixtures__');

describe('taxonomy map helpers', () => {
  it('taxonomyVersionRecord reuses the already-verified hash, never recomputing a second one', async () => {
    const result = await readTaxonomySnapshot(DIR);
    if (!result.ok) throw new Error('fixture should be verifiable');
    const record = taxonomyVersionRecord(result);
    expect(record.taxonomy_version).toBe('1.0.0');
    expect(record.taxonomy_hash).toBe(result.sha256);
  });

  it('findPatternById finds an exact real pattern and returns undefined for an unknown id', async () => {
    const result = await readTaxonomySnapshot(DIR);
    if (!result.ok) throw new Error('fixture should be verifiable');
    expect(findPatternById(result.patterns, 'FFT-001')?.name).toBe('Double Brokering');
    expect(findPatternById(result.patterns, 'FFT-999')).toBeUndefined();
  });

  it('findPatternsByCategory filters by the real category field', async () => {
    const result = await readTaxonomySnapshot(DIR);
    if (!result.ok) throw new Error('fixture should be verifiable');
    expect(findPatternsByCategory(result.patterns, 'contractual').map((p) => p.id)).toEqual(['FFT-001']);
    expect(findPatternsByCategory(result.patterns, 'identity').map((p) => p.id)).toEqual(['FFT-002']);
    expect(findPatternsByCategory(result.patterns, 'no-such-category')).toEqual([]);
  });

  it('summarizeMeta reports the real counts, not the trimmed fixture length', async () => {
    const result = await readTaxonomySnapshot(DIR);
    if (!result.ok) throw new Error('fixture should be verifiable');
    expect(summarizeMeta(result.meta)).toBe('Freight & Carrier Fraud Risk Taxonomy v1.0.0: 12 patterns, 77 indicators, 137 countermeasures');
  });
});
