import { describe, expect, it } from 'bun:test';
import { mapMutationType, decisionEvidenceToMeshEvidence, counterfactualToReplay, nonReplayableFinding } from './map';
import type { RiskReplayCounterfactualOut, RiskReplayDecisionDetail } from './client';

// Real captured responses from a live local risk-replay instance — see __fixtures__/PROVENANCE.md.
import decisionDetailFixture from './__fixtures__/decision-detail.dec-001.json';
import counterfactualFixture from './__fixtures__/counterfactual.dec-001.remove-e3.json';

const detail = decisionDetailFixture as unknown as RiskReplayDecisionDetail;
const counterfactual = counterfactualFixture as unknown as RiskReplayCounterfactualOut;
const AT = '2026-09-23T10:00:00.000Z';

describe('mapMutationType', () => {
  it('maps the five mutation types that mean the same thing in both vocabularies', () => {
    for (const type of ['REMOVE_EVIDENCE', 'CHANGE_POLICY', 'CHANGE_MODEL', 'CHANGE_THRESHOLD', 'REMOVE_TOOL_RESULT'] as const) {
      const result = mapMutationType(type);
      expect(result.ok).toBe(true);
    }
  });

  it('refuses to guess a mapping for MESH mutation types risk-replay has no equivalent for', () => {
    for (const type of ['REMOVE_SIGNAL', 'ALTER_TIMELINE', 'MODIFY_CONTEXT', 'MODIFY_CONTROL'] as const) {
      const result = mapMutationType(type);
      expect(result.ok).toBe(false);
    }
  });
});

describe('decisionEvidenceToMeshEvidence', () => {
  it('maps every real evidence item from the fixture, leaving reliability/independent unset rather than invented', () => {
    const mapped = decisionEvidenceToMeshEvidence(detail, 'case-1', AT);
    expect(mapped.length).toBe(detail.evidence.length);
    expect(mapped.length).toBe(4);
    for (const item of mapped) {
      expect(item.reliability).toBeNull();
      expect(item.independent).toBeNull();
      expect(item.provenance.source).toBe('LIVE');
    }
    expect(mapped[0]?.content_hash).toBe(detail.evidence[0]?.content_hash);
  });
});

describe('counterfactualToReplay', () => {
  it('maps the real captured DEC-001/remove-E3 divergence to FRAGILE, preserving risk-replay\'s own causal_status', () => {
    const replay = counterfactualToReplay(counterfactual, 'case-1', 'DEC-001', 'REMOVE_EVIDENCE', AT);
    expect(replay.status).toBe('FRAGILE');
    expect(counterfactual.diverged).toBe(true);
    expect(counterfactual.causal_status).toBe('DECISION_CRITICAL');
    expect(replay.finding).toContain('DECISION_CRITICAL');
    expect(replay.finding).toContain('decision-critical under the replay model');
  });

  it('never labels a replay finding as causal proof — it always names the replay model explicitly', () => {
    const replay = counterfactualToReplay(counterfactual, 'case-1', 'DEC-001', 'REMOVE_EVIDENCE', AT);
    expect(replay.finding).not.toMatch(/\bthe true cause\b/i);
    expect(replay.finding).toContain('MESH replay result');
  });
});

describe('nonReplayableFinding', () => {
  it('produces a NON_REPLAYABLE finding when risk-replay itself reports the decision is not replayable', () => {
    const nonReplayableDetail: RiskReplayDecisionDetail = { ...detail, replayability_status: 'NON_REPLAYABLE', replayability_reasons: ['MISSING_EVIDENCE'] };
    const replay = nonReplayableFinding(nonReplayableDetail, 'case-1', 'DEC-001', 'REMOVE_EVIDENCE', AT);
    expect(replay.status).toBe('NON_REPLAYABLE');
    expect(replay.finding).toContain('MISSING_EVIDENCE');
  });
});
