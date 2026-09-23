import { describe, expect, it } from 'bun:test';
import { validateMeshObject } from '../../contracts';
import { MODEL_REGISTRY, findModelProfile, getModelRegistry } from './registry';

describe('MODEL_REGISTRY', () => {
  it('has exactly the 5 entries docs/MODEL_ARENA.md specifies (3 Laya checkpoints + jev + open-jev)', () => {
    expect(MODEL_REGISTRY.map((m) => m.model_id)).toEqual(['laya-english', 'laya-multilingual', 'laya-typed', 'jev', 'open-jev']);
  });

  it('every entry is honestly NOT_CONNECTED with provenance.source UNAVAILABLE, never a fabricated ACTIVE status', () => {
    for (const entry of MODEL_REGISTRY) {
      expect(entry.status).toBe('NOT_CONNECTED');
      expect(entry.provenance.source).toBe('UNAVAILABLE');
    }
  });

  it('every entry has an empty benchmark_results array — no invented numbers', () => {
    for (const entry of MODEL_REGISTRY) {
      expect(entry.benchmark_results).toEqual([]);
    }
  });

  it('every entry validates against the real ModelProfile zod schema', () => {
    for (const entry of MODEL_REGISTRY) {
      const result = validateMeshObject('model-profile', entry);
      expect(result.ok).toBe(true);
    }
  });

  it('getModelRegistry() and findModelProfile() read from the same array', () => {
    expect(getModelRegistry()).toBe(MODEL_REGISTRY);
    expect(findModelProfile('laya-english')?.checkpoint).toBe('convaiinnovations/laya');
    expect(findModelProfile('does-not-exist')).toBeUndefined();
  });
});
