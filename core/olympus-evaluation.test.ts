import { describe, expect, it } from 'bun:test';
import { evaluateDeterministicCases } from './olympus-evaluation';

describe('Olympus deterministic evaluation', () => {
  it('computes measured metrics including failure cases', () => {
    const metrics = evaluateDeterministicCases('olympus-demo-v1', [
      { id: 'tp', expectedHumanReview: true, observedAction: 'HUMAN_REVIEW', rerunAction: 'HUMAN_REVIEW', latencyMs: 10 },
      { id: 'fn', expectedHumanReview: true, observedAction: 'ACCEPT', rerunAction: 'ACCEPT', latencyMs: 20 },
      { id: 'fp', expectedHumanReview: false, observedAction: 'HUMAN_REVIEW', rerunAction: 'HUMAN_REVIEW', latencyMs: 30 },
      { id: 'tn', expectedHumanReview: false, observedAction: 'ACCEPT', rerunAction: 'ACCEPT', latencyMs: 40 },
    ]);
    expect(metrics).toEqual({ datasetVersion: 'olympus-demo-v1', sampleCount: 4, precision: 0.5, recall: 0.5, falsePositiveRate: 0.5, falseNegativeRate: 0.5, escalationAccuracy: 0.5, reproducibility: 1, averageLatencyMs: 25 });
  });

  it('fails closed on empty datasets and invalid latency', () => {
    expect(() => evaluateDeterministicCases('v1', [])).toThrow('at least one');
    expect(() => evaluateDeterministicCases('v1', [{ id: 'bad', expectedHumanReview: true, observedAction: 'HUMAN_REVIEW', rerunAction: 'HUMAN_REVIEW', latencyMs: -1 }])).toThrow('invalid latency');
  });
});

