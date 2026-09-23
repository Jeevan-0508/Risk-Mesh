import { describe, expect, it } from 'bun:test';
import { assessCouncilResult } from './adapter';
import type { CouncilResult } from './types';
import majorityFixture from './__fixtures__/council-result.majority.json';
import degradedFixture from './__fixtures__/council-result.degraded.json';

const majority = majorityFixture as unknown as CouncilResult;
const degraded = degradedFixture as unknown as CouncilResult;
const ARGS = { caseId: 'case-1', observedAt: '2026-09-23T12:00:00.000Z', provenanceSource: 'MOCKED' as const, upstreamRef: 'risk-swarm@d9df788' };

describe('assessCouncilResult', () => {
  it('produces model results, a resolved disagreement, and a model_agreement score for the real majority fixture', () => {
    const result = assessCouncilResult(majority, ARGS);
    expect(result.modelResults.length).toBe(3);
    expect(result.disagreement?.status).toBe('RESOLVED');
    expect(result.disagreementSkippedReason).toBeNull();
    expect(result.modelAgreementScore).toBeCloseTo(0.7, 5);
  });

  it('still produces model results for a degraded case, and a disagreement over the 2 independent positions', () => {
    const result = assessCouncilResult(degraded, ARGS);
    expect(result.modelResults.length).toBe(3);
    expect(result.disagreement?.model_ids).toEqual(['ATHENA', 'HADES']);
    expect(result.modelAgreementScore).toBeCloseTo(0.95, 5);
  });

  it('surfaces disagreementSkippedReason honestly instead of a null disagreement with no explanation', () => {
    const tooFewIndependent: CouncilResult = {
      ...degraded,
      positions: { ...degraded.positions, HADES: { ...degraded.positions.HADES, degraded: true, degraded_reason: 'provider returned HTTP 500' } },
    };
    const result = assessCouncilResult(tooFewIndependent, ARGS);
    expect(result.disagreement).toBeNull();
    expect(result.disagreementSkippedReason).toContain('independent');
  });
});
