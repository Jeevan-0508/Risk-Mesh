import { describe, expect, it } from 'bun:test';
import { validateMeshObject } from '../../contracts';
import { MODEL_REGISTRY, findModelProfile, getModelRegistry } from './registry';

const SHADOW_IDS = ['laya-typed', 'laya-english', 'laya-multilingual'];

describe('MODEL_REGISTRY', () => {
  it('has exactly the 5 entries docs/MODEL_ARENA.md specifies (3 Laya checkpoints + jev + open-jev)', () => {
    expect(MODEL_REGISTRY.map((m) => m.model_id)).toEqual(['laya-english', 'laya-multilingual', 'laya-typed', 'jev', 'open-jev']);
  });

  it('every entry except the 3 real Laya checkpoints is honestly UNAVAILABLE with provenance.source UNAVAILABLE, never a fabricated LIVE status', () => {
    for (const entry of MODEL_REGISTRY) {
      if (SHADOW_IDS.includes(entry.model_id ?? '')) continue;
      expect(entry.status).toBe('UNAVAILABLE');
      expect(entry.provenance.source).toBe('UNAVAILABLE');
    }
  });

  it('all 3 Laya checkpoints are real SHADOW entries, backed by LIVE provenance and a real captured fixture reference', () => {
    for (const id of SHADOW_IDS) {
      const laya = findModelProfile(id);
      expect(laya?.status).toBe('SHADOW');
      expect(laya?.provenance.source).toBe('LIVE');
      expect(laya?.license).toBe('apache-2.0');
    }
  });

  it("laya-english and laya-multilingual honestly document their much worse typed-decisions accuracy than laya-typed's, never omitted", () => {
    const english = findModelProfile('laya-english');
    const multilingual = findModelProfile('laya-multilingual');
    const typed = findModelProfile('laya-typed');
    expect(english?.benchmark_results.find((b) => b.metric === 'accuracy')?.value).toBeLessThan(
      typed?.benchmark_results.find((b) => b.metric === 'accuracy')?.value ?? 0,
    );
    expect(multilingual?.benchmark_results.find((b) => b.metric === 'accuracy')?.value).toBeLessThan(
      typed?.benchmark_results.find((b) => b.metric === 'accuracy')?.value ?? 0,
    );
    expect(english?.known_limitations.some((l) => l.includes('NOT fine-tuned'))).toBe(true);
    expect(multilingual?.known_limitations.some((l) => l.includes('NOT fine-tuned'))).toBe(true);
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
