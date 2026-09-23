import { describe, expect, it } from 'bun:test';
import { readVerifiedSnapshotFile } from './snapshot-provenance';
import { join } from 'node:path';

const DIR = join(import.meta.dir, '__fixtures__');

describe('readVerifiedSnapshotFile', () => {
  it('reads and hash-verifies a real trimmed fomo fixture successfully', async () => {
    const result = await readVerifiedSnapshotFile(DIR, 'fomo', 'fomo/signals.json');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.status).toBe('SNAPSHOT');
    expect(result.source.upstream_repo).toBe('FOMO');
    expect(result.buffer.length).toBe(result.file.bytes);
  });

  it('reads and hash-verifies the real trimmed freight-risk-atlas fixture successfully', async () => {
    const result = await readVerifiedSnapshotFile(DIR, 'freight-risk-atlas', 'freight-risk-atlas/taxonomy.json');
    expect(result.ok).toBe(true);
  });

  it('fails closed on an unknown source key rather than assuming an empty source', async () => {
    const result = await readVerifiedSnapshotFile(DIR, 'not-a-real-source', 'fomo/signals.json');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error).toContain('not-a-real-source');
  });

  it('fails closed on a hash mismatch rather than trusting the file anyway', async () => {
    const mismatchDir = join(import.meta.dir, '__fixtures__/mismatch-dir');
    const result = await readVerifiedSnapshotFile(mismatchDir, 'fomo', 'fomo/signals.json');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error).toContain('hash mismatch');
  });

  it('returns UNAVAILABLE, never a fabricated result, when provenance.json itself is missing', async () => {
    const result = await readVerifiedSnapshotFile(join(import.meta.dir, 'does-not-exist'), 'fomo', 'fomo/signals.json');
    expect(result.ok).toBe(false);
  });
});
