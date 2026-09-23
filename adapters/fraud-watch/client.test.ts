import { describe, expect, it } from 'bun:test';
import { readMoRecords } from './client';
import { join } from 'node:path';

const REAL_FIXTURE = join(import.meta.dir, '__fixtures__/world-state.mos.json');
const MALFORMED_FIXTURE = join(import.meta.dir, '__fixtures__/world-state.malformed.json');

describe('readMoRecords', () => {
  it('reads both real MO records from a real captured world-state.json, unwrapping the [id, record] Map serialization', async () => {
    const result = await readMoRecords(REAL_FIXTURE);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.status).toBe('SIMULATED');
    expect(result.mos.length).toBe(2);
    expect(result.mos.map((m) => m.id)).toEqual(['MO-0001', 'MO-0002']);
    expect(result.mos[0]?.classification).toBe('EMERGING_BEHAVIOR');
    expect(result.mos[0]?.signature).toContain('EQUIPMENT_CARRIER_MISMATCH');
  });

  it('returns UNAVAILABLE, never a fabricated result, when the file does not exist', async () => {
    const result = await readMoRecords(join(import.meta.dir, '__fixtures__/does-not-exist.json'));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe('UNAVAILABLE');
    expect(result.error).toContain('does-not-exist.json');
  });

  it('returns UNAVAILABLE when moEngine.mos is missing, rather than assuming an empty simulation', async () => {
    const result = await readMoRecords(MALFORMED_FIXTURE);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error).toContain('moEngine.mos');
  });
});
