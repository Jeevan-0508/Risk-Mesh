import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { shannonUncertainty, mapLayaAnswerToModelResultFields } from './laya-runtime';

const fixture = JSON.parse(
  readFileSync(join(import.meta.dir, '__fixtures__', 'laya-typed-fabrication-call.json'), 'utf-8'),
);
const realAnswer = fixture.output.result.answers.fabrication_call;

describe('shannonUncertainty', () => {
  it('is near 1 for the real near-uniform 3-way fixture distribution (genuinely uncertain call)', () => {
    const u = shannonUncertainty(realAnswer.probabilities);
    expect(u).not.toBeNull();
    expect(u as number).toBeGreaterThan(0.9);
  });

  it('is 0 for a single-option distribution (nothing to be uncertain about)', () => {
    expect(shannonUncertainty({ only: 1.0 })).toBe(0);
  });

  it('is near 0 for a sharply peaked distribution', () => {
    const u = shannonUncertainty({ a: 0.98, b: 0.01, c: 0.01 });
    expect(u as number).toBeLessThan(0.2);
  });

  it('is null when there is no distribution at all, never fabricated', () => {
    expect(shannonUncertainty(null)).toBeNull();
    expect(shannonUncertainty(undefined)).toBeNull();
  });
});

describe('mapLayaAnswerToModelResultFields', () => {
  it('maps the real captured fixture answer end-to-end', () => {
    const fields = mapLayaAnswerToModelResultFields(realAnswer);
    expect(fields.decision).toBe('inconclusive');
    expect(fields.confidence).toBe(0.0238);
    expect(fields.primitive).toBe('choice');
    expect(fields.probabilities).toEqual(realAnswer.probabilities);
    expect(fields.uncertainty as number).toBeGreaterThan(0.9);
    expect(fields.raw_output).toEqual(realAnswer);
  });

  it('stringifies a score-type answer\'s numeric score as the decision, never invents a label', () => {
    const fields = mapLayaAnswerToModelResultFields({ type: 'score', score: 2.7, confidence: 0.6 } as any);
    expect(fields.decision).toBe('2.7');
    expect(fields.primitive).toBe('score');
  });

  it('stringifies a noul-type answer\'s float as the decision', () => {
    const fields = mapLayaAnswerToModelResultFields({ type: 'noul', noul: 0.83, confidence: 0.83 } as any);
    expect(fields.decision).toBe('0.83');
    expect(fields.primitive).toBe('noul');
    expect(fields.probabilities).toBeNull();
    expect(fields.uncertainty).toBeNull();
  });
});
