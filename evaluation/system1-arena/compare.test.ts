import { describe, expect, it } from 'bun:test';
import { compareModelResults } from './compare';
import type { ModelResult } from '../../contracts/schemas';

function makeResult(modelId: string, decision: string, confidence: number): ModelResult {
  return {
    id: `test-modelresult-${modelId}`,
    schema_version: '1.0',
    created_at: '2026-09-23T00:00:00.000Z',
    source: 'test',
    provenance: { source: 'LIVE', system: modelId, retrieved_at: '2026-09-23T00:00:00.000Z', upstream_ref: null, note: null },
    status: 'RECORDED',
    case_id: 'dec-arena-test',
    model_id: modelId,
    checkpoint: `checkpoint-${modelId}`,
    decision,
    probabilities: null,
    confidence,
    uncertainty: null,
    primitive: 'choice',
    latency_ms: 100,
    raw_output: null,
  };
}

describe('compareModelResults', () => {
  it('refuses to compare fewer than 2 results - an arena of one is not an arena', () => {
    expect(() => compareModelResults([makeResult('a', 'x', 0.9)], { caseId: 'c', observedAt: 't' })).toThrow();
  });

  it('reports agreement when every independent model reaches the same decision', () => {
    const comparison = compareModelResults(
      [makeResult('laya-typed', 'fabricated', 0.8), makeResult('laya-english', 'fabricated', 0.6)],
      { caseId: 'dec-arena-test', observedAt: '2026-09-23T00:00:00.000Z' },
    );
    expect(comparison.agreement).toBe(true);
  });

  it('produces a real OPEN Disagreement, never averaged away, when decisions differ', () => {
    const comparison = compareModelResults(
      [makeResult('laya-typed', 'fabricated', 0.8), makeResult('laya-english', 'consistent', 0.6)],
      { caseId: 'dec-arena-test', observedAt: '2026-09-23T00:00:00.000Z' },
    );
    expect(comparison.agreement).toBe(false);
    if (comparison.agreement) throw new Error('unreachable');
    expect(comparison.disagreement.status).toBe('OPEN');
    expect(comparison.disagreement.case_id).toBe('dec-arena-test');
    expect(comparison.disagreement.model_ids).toEqual(['laya-typed', 'laya-english']);
    expect(comparison.disagreement.positions).toEqual([
      { model_id: 'laya-typed', stance: 'fabricated', confidence: 0.8 },
      { model_id: 'laya-english', stance: 'consistent', confidence: 0.6 },
    ]);
    expect(comparison.disagreement.resolution).toBeNull();
    expect(comparison.model_agreement_score).toBeLessThan(0.5);
  });

  it('scores full agreement higher than any disagreement, an ASSUMED placeholder ordering, not a fitted value', () => {
    const agree = compareModelResults(
      [makeResult('a', 'x', 0.9), makeResult('b', 'x', 0.9)],
      { caseId: 'c', observedAt: 't' },
    );
    const disagree = compareModelResults(
      [makeResult('a', 'x', 0.9), makeResult('b', 'y', 0.9)],
      { caseId: 'c', observedAt: 't' },
    );
    expect(agree.model_agreement_score).toBeGreaterThan(disagree.model_agreement_score);
  });

  it('detects disagreement across 3+ independent models, not just pairs', () => {
    const comparison = compareModelResults(
      [makeResult('a', 'x', 0.5), makeResult('b', 'x', 0.5), makeResult('c', 'y', 0.5)],
      { caseId: 'c', observedAt: 't' },
    );
    expect(comparison.agreement).toBe(false);
    if (comparison.agreement) throw new Error('unreachable');
    expect(comparison.disagreement.model_ids).toHaveLength(3);
  });
});
