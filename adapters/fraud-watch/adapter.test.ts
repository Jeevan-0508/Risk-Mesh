import { describe, expect, it } from 'bun:test';
import { assessFraudWatchBehaviors } from './adapter';
import { join } from 'node:path';

const REAL_FIXTURE = join(import.meta.dir, '__fixtures__/world-state.mos.json');
const AT = '2026-09-23T10:00:00.000Z';

describe('assessFraudWatchBehaviors', () => {
  it('maps every real MO record in the fixture to a Behavior, none skipped, all simulated', async () => {
    const result = await assessFraudWatchBehaviors(REAL_FIXTURE, 'case-1', AT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.behaviors.length).toBe(2);
    expect(result.skipped.length).toBe(0);
    for (const behavior of result.behaviors) {
      expect(behavior.simulated).toBe(true);
      expect(behavior.status).toBe('SIMULATED');
      expect(behavior.case_id).toBe('case-1');
    }
  });

  it('returns ok:false, never a fabricated empty result, when the world-state file is missing', async () => {
    const result = await assessFraudWatchBehaviors(join(import.meta.dir, '__fixtures__/does-not-exist.json'), 'case-1', AT);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toContain('UNAVAILABLE');
  });

  it('defaults now to the current time when not provided, still producing valid ISO timestamps', async () => {
    const result = await assessFraudWatchBehaviors(REAL_FIXTURE, 'case-1');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(() => new Date(result.behaviors[0]!.created_at).toISOString()).not.toThrow();
  });
});
