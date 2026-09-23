import { describe, expect, it } from 'bun:test';
import { assessModelCall, getModelRegistry, registryStatusSummary } from './adapter';
import type { LayaRuntimeResult } from './laya-runtime';

const fakeLayaRunner = (): LayaRuntimeResult => ({
  ok: true,
  load_seconds: 15.3,
  infer_seconds: 0.446,
  result: {
    model: 'laya-rl-agent',
    answers: { q: { type: 'choice', choice: 'fabricated', probabilities: { consistent: 0.1, fabricated: 0.8, inconclusive: 0.1 }, confidence: 0.7 } },
    usage: { input_tokens: 50, output_tokens: 0 },
  },
});

describe('assessModelCall', () => {
  it('still never fabricates a result for a genuinely unavailable model', async () => {
    const result = await assessModelCall('jev', {});
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toContain('UNAVAILABLE');
  });

  it('returns a real ok:true ModelResult for laya-typed via an injected runner', async () => {
    const result = await assessModelCall(
      'laya-typed',
      { case_id: 'dec-test-003', state: 'x', question: { type: 'choice', instructions: 'x', criteria: ['a', 'b', 'c'] } },
      { layaRunner: fakeLayaRunner },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.result.decision).toBe('fabricated');
    expect(result.result.model_id).toBe('laya-typed');
  });

  it('also returns a real ok:true ModelResult for laya-english and laya-multilingual, not just laya-typed', async () => {
    for (const modelId of ['laya-english', 'laya-multilingual']) {
      const result = await assessModelCall(
        modelId,
        { case_id: 'dec-test-004', state: 'x', question: { type: 'choice', instructions: 'x', criteria: ['a', 'b', 'c'] } },
        { layaRunner: fakeLayaRunner },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.result.model_id).toBe(modelId);
    }
  });
});

describe('registryStatusSummary / getModelRegistry', () => {
  it('reports 2 UNAVAILABLE entries (jev, open-jev) and 3 SHADOW entries (the 3 Laya checkpoints)', () => {
    const summary = registryStatusSummary();
    expect(summary).toHaveLength(5);
    const byId = Object.fromEntries(summary.map((s) => [s.model_id, s.status]));
    expect(['laya-typed', 'laya-english', 'laya-multilingual'].every((id) => byId[id] === 'SHADOW')).toBe(true);
    expect(['jev', 'open-jev'].every((id) => byId[id] === 'UNAVAILABLE')).toBe(true);
  });

  it('getModelRegistry is re-exported unchanged from registry.ts', () => {
    expect(getModelRegistry()).toHaveLength(5);
  });
});
