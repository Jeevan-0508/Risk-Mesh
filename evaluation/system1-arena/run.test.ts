import { describe, expect, it } from 'bun:test';
import { runSystem1Arena } from './run';
import type { LayaRuntimeResult, LayaInferenceInput } from '../../adapters/model-registry/laya-runtime';

const answerFor = (checkpoint: string): LayaRuntimeResult => {
  if (checkpoint === 'convaiinnovations/laya-typed-decisions') {
    return {
      ok: true,
      load_seconds: 15.3,
      infer_seconds: 0.446,
      result: {
        model: 'laya-rl-agent',
        answers: { q: { type: 'choice', choice: 'inconclusive', probabilities: { consistent: 0.32, fabricated: 0.25, inconclusive: 0.43 }, confidence: 0.02 } },
        usage: { input_tokens: 105, output_tokens: 0 },
      },
    };
  }
  if (checkpoint === 'convaiinnovations/laya') {
    return {
      ok: true,
      load_seconds: 285,
      infer_seconds: 0.43,
      result: {
        model: 'laya-rl-agent',
        answers: { q: { type: 'choice', choice: 'consistent', probabilities: { consistent: 0.47, fabricated: 0.19, inconclusive: 0.34 }, confidence: 0.06 } },
        usage: { input_tokens: 105, output_tokens: 0 },
      },
    };
  }
  if (checkpoint === 'convaiinnovations/laya-multilingual') {
    return {
      ok: true,
      load_seconds: 209,
      infer_seconds: 0.2,
      result: {
        model: 'laya-rl-agent',
        answers: { q: { type: 'choice', choice: 'inconclusive', probabilities: { consistent: 0.14, fabricated: 0.06, inconclusive: 0.79 }, confidence: 0.42 } },
        usage: { input_tokens: 105, output_tokens: 0 },
      },
    };
  }
  return { ok: false, error: `no fixture answer wired up for checkpoint ${checkpoint}` };
};

const fakeLayaRunner = (input: LayaInferenceInput): LayaRuntimeResult => answerFor(input.checkpoint);
const FIXED_NOW = () => '2026-09-23T12:00:00.000Z';
const SOME_QUESTION = { type: 'choice' as const, instructions: 'x', criteria: ['a', 'b', 'c'] };
const SOME_INPUT = { case_id: 'arena-test-001', state: 'x', question: SOME_QUESTION };

describe('runSystem1Arena', () => {
  it('refuses to run an arena of fewer than 2 requested model_ids', async () => {
    const result = await runSystem1Arena(['laya-typed'], SOME_INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toContain('at least 2');
    expect(result.partialResults).toEqual([]);
  });

  it('genuinely calls laya-typed and laya-english independently and compares their real, different answers - a real disagreement, not staged', async () => {
    const result = await runSystem1Arena(
      ['laya-typed', 'laya-english'],
      SOME_INPUT,
      { layaRunner: fakeLayaRunner, now: FIXED_NOW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.results).toHaveLength(2);
    expect(result.results.map((r) => r.model_id).sort()).toEqual(['laya-english', 'laya-typed']);
    expect(result.results.map((r) => r.decision)).toEqual(['inconclusive', 'consistent']);
    expect(result.comparison.agreement).toBe(false);
    if (result.comparison.agreement) throw new Error('unreachable');
    expect(result.comparison.disagreement.model_ids.sort()).toEqual(['laya-english', 'laya-typed']);
    expect(result.failures).toEqual([]);
  });

  it('produces a genuine agreement when the two live checkpoints happen to answer the same way', async () => {
    const agreeingRunner = () => answerFor('convaiinnovations/laya-typed-decisions');
    const result = await runSystem1Arena(
      ['laya-typed', 'laya-english'],
      SOME_INPUT,
      { layaRunner: agreeingRunner, now: FIXED_NOW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.comparison.agreement).toBe(true);
    if (!result.comparison.agreement) throw new Error('unreachable');
    expect(result.comparison.model_agreement_score).toBeGreaterThan(0.5);
  });

  it('fails closed with the real per-model failure reasons when only 1 of 2 requested models is actually connected (jev is honestly UNAVAILABLE)', async () => {
    const result = await runSystem1Arena(
      ['laya-typed', 'jev'],
      SOME_INPUT,
      { layaRunner: fakeLayaRunner, now: FIXED_NOW },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.partialResults).toHaveLength(1);
    expect(result.partialResults[0]?.model_id).toBe('laya-typed');
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain('jev');
    expect(result.failures[0]).toContain('UNAVAILABLE');
  });

  it('compares all 3 real Laya checkpoints at once when asked for all 3, never silently dropping a 3rd model', async () => {
    const result = await runSystem1Arena(
      ['laya-typed', 'laya-english', 'laya-multilingual'],
      SOME_INPUT,
      { layaRunner: fakeLayaRunner, now: FIXED_NOW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.results).toHaveLength(3);
    expect(result.comparison.agreement).toBe(false);
    if (result.comparison.agreement) throw new Error('unreachable');
    expect(result.comparison.disagreement.model_ids).toHaveLength(3);
  });
});
