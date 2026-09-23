import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { assessTaxonomy } from './adapter';

const DIR = join(import.meta.dir, '../_shared/__fixtures__');

describe('assessTaxonomy', () => {
  it('composes client + map into meta, patterns and a version record from the real fixture', async () => {
    const result = await assessTaxonomy(DIR);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.meta.pattern_count).toBe(12);
    expect(result.patterns).toHaveLength(2);
    expect(result.versionRecord.taxonomy_version).toBe('1.0.0');
    expect(result.versionRecord.taxonomy_hash).toHaveLength(64);
  });

  it('returns ok:false with a reason, never a fabricated taxonomy, when the snapshot is unavailable', async () => {
    const result = await assessTaxonomy(join(import.meta.dir, 'does-not-exist'));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toContain('UNAVAILABLE');
  });
});
