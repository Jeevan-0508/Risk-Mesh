import { describe, expect, it } from 'bun:test';
import { callModel } from './client';
import type { LayaRuntimeResult } from './laya-runtime';

const FIXTURE_ANSWER = {
  type: 'choice' as const,
  choice: 'inconclusive',
  probabilities: { consistent: 0.3191, fabricated: 0.2475, inconclusive: 0.4334 },
  confidence: 0.0238,
  action: { act_probability: 1.0 },
};

const fakeLayaRunner = (): LayaRuntimeResult => ({
  ok: true,
  load_seconds: 15.3,
  infer_seconds: 0.446,
  result: { model: 'laya-rl-agent', answers: { q: FIXTURE_ANSWER }, usage: { input_tokens: 105, output_tokens: 0 } },
});

const SOME_QUESTION = { type: 'choice' as const, instructions: 'x', criteria: ['a', 'b'] };

describe('callModel', () => {
  it('fails closed with UNAVAILABLE for jev and open-jev, never returning a ModelResult', async () => {
    for (const modelId of ['jev', 'open-jev']) {
      const result = await callModel(modelId, {});
      expect(result.ok).toBe(false);
      expect(result.status).toBe('UNAVAILABLE');
    }
  });

  it('fails closed with UNAVAILABLE for an id not in the registry at all', async () => {
    const result = await callModel('gpt-not-a-real-mesh-entry', {});
    expect(result.ok).toBe(false);
    expect(result.status).toBe('UNAVAILABLE');
  });

  it('the UNAVAILABLE reason names the actual missing dependency, not a generic message', async () => {
    const jev = await callModel('jev', {});
    if (jev.ok) throw new Error('unreachable');
    expect(jev.reason).toContain('invite-only');
  });

  it.each(['laya-typed', 'laya-english', 'laya-multilingual'])(
    '%s fails closed with ERROR (never a fabricated result) when state or question is missing',
    async (modelId) => {
      const result = await callModel(modelId, {});
      expect(result.ok).toBe(false);
      expect(result.status).toBe('ERROR');
    },
  );

  it('laya-typed returns a real ok:true ModelResult when the (injected) runner succeeds', async () => {
    const result = await callModel(
      'laya-typed',
      { case_id: 'dec-test-001', state: 'test state', question: SOME_QUESTION },
      { layaRunner: fakeLayaRunner, now: () => '2026-09-23T12:00:00.000Z' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.status).toBe('SHADOW');
    expect(result.result.model_id).toBe('laya-typed');
    expect(result.result.decision).toBe('inconclusive');
    expect(result.result.confidence).toBe(0.0238);
    expect(result.result.probabilities).toEqual(FIXTURE_ANSWER.probabilities);
    expect(result.result.primitive).toBe('choice');
    expect(result.result.uncertainty).toBeGreaterThan(0.9);
    expect(result.result.raw_output).toEqual(FIXTURE_ANSWER);
    expect(result.result.provenance.source).toBe('LIVE');
  });

  it('laya-english and laya-multilingual also return a real ok:true ModelResult, using their own checkpoint and upstream_ref - the promotion is not laya-typed-only', async () => {
    for (const modelId of ['laya-english', 'laya-multilingual']) {
      const result = await callModel(
        modelId,
        { case_id: 'dec-test-003', state: 'test state', question: SOME_QUESTION },
        { layaRunner: fakeLayaRunner, now: () => '2026-09-23T12:00:00.000Z' },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.status).toBe('SHADOW');
      expect(result.result.model_id).toBe(modelId);
      expect(result.result.provenance.upstream_ref).toContain(modelId === 'laya-english' ? 'convaiinnovations/laya' : 'convaiinnovations/laya-multilingual');
    }
  });

  it('laya-typed fails closed with ERROR (never a fabricated result) when the runner itself fails', async () => {
    const result = await callModel(
      'laya-typed',
      { case_id: 'dec-test-002', state: 'x', question: SOME_QUESTION },
      { layaRunner: () => ({ ok: false, error: 'simulated subprocess failure' }) },
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('ERROR');
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toContain('simulated subprocess failure');
  });
});
