import { describe, expect, it } from 'bun:test';
import { validateMeshObject } from '../../contracts';
import { MODEL_REGISTRY, findModelProfile, getModelRegistry } from './registry';

describe('MODEL_REGISTRY', () => {
  it('has exactly the 5 entries docs/MODEL_ARENA.md specifies (3 Laya checkpoints + jev + open-jev)', () => {
    expect(MODEL_REGISTRY.map((m) => m.model_id)).toEqual(['laya-english', 'laya-multilingual', 'laya-typed', 'jev', 'open-jev']);
  });

  it('every entry except laya-typed is honestly UNAVAILABLE with provenance.source UNAVAILABLE, never a fabricated LIVE status', () => {
    for (const entry of MODEL_REGISTRY) {
      if (entry.model_id === 'laya-typed') continue;
      expect(entry.status).toBe('UNAVAILABLE');
      expect(entry.provenance.source).toBe('UNAVAILABLE');
    }
  });

  it('laya-typed is the one real SHADOW entry, backed by a LIVE provenance and a real captured fixture reference', () => {
    const laya = findModelProfile('laya-typed');
    expect(laya?.status).toBe('SHADOW');
    expect(laya?.provenance.source).toBe('LIVE');
    expect(laya?.license).toBe('apache-2.0');
  });

  it('every benchmark_results entry is tagged SELF_REPORTED, THIRD_PARTY, or MESH_MEASURED - none MESH_MEASURED yet', () => {
    for (const entry of MODEL_REGISTRY) {
      for (const b of entry.benchmark_results) {
        expect(['SELF_REPORTED', 'THIRD_PARTY', 'MESH_MEASURED']).toContain(b.kind);
        expect(b.kind).not.toBe('MESH_MEASURED');
      }
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
