import { describe, expect, it } from 'bun:test';
import { agreementToModelAgreementScore, councilPositionsToModelResults, councilToDisagreement } from './map';
import type { CouncilResult } from './types';
import majorityFixture from './__fixtures__/council-result.majority.json';
import degradedFixture from './__fixtures__/council-result.degraded.json';

const majority = majorityFixture as unknown as CouncilResult;
const degraded = degradedFixture as unknown as CouncilResult;
const AT = '2026-09-23T12:00:00.000Z';
const ARGS = { caseId: 'case-1', observedAt: AT, provenanceSource: 'MOCKED' as const, upstreamRef: 'risk-swarm@d9df788' };

describe('councilPositionsToModelResults', () => {
  it('maps all three real positions from the majority fixture, including the dissenting one', () => {
    const results = councilPositionsToModelResults(majority, ARGS);
    expect(results.length).toBe(3);
    const hades = results.find((r) => r.model_id === 'HADES');
    expect(hades?.decision).toBe('lion');
    expect(hades?.confidence).toBe(0.55);
    expect(results.every((r) => r.status === 'RECORDED')).toBe(true);
  });

  it('preserves a real degraded position rather than dropping it, with the reason in provenance.note', () => {
    const results = councilPositionsToModelResults(degraded, ARGS);
    const ares = results.find((r) => r.model_id === 'ARES');
    expect(ares).toBeDefined();
    expect(ares?.provenance.note).toContain('degraded');
    expect(ares?.provenance.note).toContain('HTTP 429');
  });

  it('never invents probabilities risk-swarm never asserted', () => {
    const results = councilPositionsToModelResults(majority, ARGS);
    for (const r of results) expect(r.probabilities).toBeNull();
  });
});

describe('councilToDisagreement', () => {
  it('maps the real MAJORITY fixture to a RESOLVED disagreement, since verdict_type is MAJORITY not UNRESOLVED', () => {
    const result = councilToDisagreement(majority, ARGS);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.disagreement.status).toBe('RESOLVED');
    expect(result.disagreement.resolution).toBe('tiger');
    expect(result.disagreement.model_ids.sort()).toEqual(['ARES', 'ATHENA', 'HADES']);
    expect(result.disagreement.positions.length).toBe(3);
  });

  it('excludes a degraded position from model_ids/positions, still resolving with the 2 independent ones', () => {
    const result = councilToDisagreement(degraded, ARGS);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.disagreement.model_ids).toEqual(['ATHENA', 'HADES']);
    expect(result.disagreement.model_ids).not.toContain('ARES');
  });

  it('fails closed (never counts a fallback as independent) when fewer than 2 non-degraded positions exist', () => {
    const onlyOneIndependent: CouncilResult = {
      ...degraded,
      positions: {
        ...degraded.positions,
        HADES: { ...degraded.positions.HADES, degraded: true, degraded_reason: 'provider returned HTTP 500' },
      },
    };
    const result = councilToDisagreement(onlyOneIndependent, ARGS);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toContain('independent');
  });
});

describe('agreementToModelAgreementScore', () => {
  it('orders the four real risk-swarm agreement labels monotonically, strong_consensus highest', () => {
    expect(agreementToModelAgreementScore('strong_consensus')).toBeGreaterThan(agreementToModelAgreementScore('majority'));
    expect(agreementToModelAgreementScore('majority')).toBeGreaterThan(agreementToModelAgreementScore('split'));
    expect(agreementToModelAgreementScore('split')).toBeGreaterThan(agreementToModelAgreementScore('inconclusive'));
  });
});
