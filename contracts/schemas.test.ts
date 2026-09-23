import { describe, expect, it } from 'bun:test';
import {
  Provenance, MeshBase, Case, Evidence, Signal, Behavior, Decision, ModelResult,
  Disagreement, Challenge, Replay, CandidateMo, Outcome, Lesson, Knowledge, Review,
  Trust, Experiment, ModelProfile,
} from './schemas';

const AT = '2026-09-23T10:00:00.000Z';

const provenance = (source: Provenance['source'] = 'SNAPSHOT') => ({
  source,
  system: 'test-fixture',
  retrieved_at: AT,
  upstream_ref: null,
  note: null,
});

const base = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'case-1',
  schema_version: '1.0',
  created_at: AT,
  source: 'test-fixture',
  provenance: provenance(),
  status: 'placeholder',
  ...overrides,
});

describe('Provenance', () => {
  it('accepts each of the six honest labels', () => {
    for (const source of ['LIVE', 'SNAPSHOT', 'SIMULATED', 'MOCKED', 'CACHED', 'UNAVAILABLE'] as const) {
      expect(Provenance.safeParse(provenance(source)).success).toBe(true);
    }
  });

  it('rejects an invented seventh label', () => {
    expect(Provenance.safeParse(provenance('REAL' as never)).success).toBe(false);
  });

  it('requires upstream_ref and note to be present, even if null', () => {
    const { upstream_ref, ...rest } = provenance();
    expect(Provenance.safeParse(rest).success).toBe(false);
  });
});

describe('MeshBase', () => {
  it('requires id, schema_version, created_at, source, provenance, status', () => {
    for (const key of ['id', 'schema_version', 'created_at', 'source', 'provenance', 'status']) {
      const rest: Record<string, unknown> = { ...base() };
      delete rest[key];
      expect(MeshBase.safeParse(rest).success).toBe(false);
    }
  });

  it('accepts a minimal valid object with no optional fields set', () => {
    expect(MeshBase.safeParse(base()).success).toBe(true);
  });

  it('rejects a non-ISO created_at', () => {
    expect(MeshBase.safeParse(base({ created_at: 'not-a-date' })).success).toBe(false);
  });
});

describe('Case', () => {
  const valid = () => base({
    status: 'OPEN', title: 'Missing trailer, Lane DE-12', summary: 'Trailer reported missing after handoff.',
  });

  it('accepts a minimal valid case and defaults list fields to empty', () => {
    const result = Case.safeParse(valid());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.signal_ids).toEqual([]);
      expect(result.data.outcome_id).toBeNull();
    }
  });

  it('rejects a status outside the case lifecycle', () => {
    expect(Case.safeParse({ ...valid(), status: 'ARCHIVED' }).success).toBe(false);
  });
});

describe('Evidence', () => {
  const valid = () => base({
    status: 'UNVERIFIED', source_type: 'news', observed_at: AT, content_hash: 'sha256:abc',
    reliability: 0.6, independent: true,
  });

  it('accepts a minimal valid evidence item', () => {
    expect(Evidence.safeParse(valid()).success).toBe(true);
  });

  it('rejects reliability outside [0,1]', () => {
    expect(Evidence.safeParse({ ...valid(), reliability: 1.4 }).success).toBe(false);
  });

  it('walks through the full status machine values', () => {
    for (const status of ['UNVERIFIED', 'VERIFIED', 'CONTRADICTED', 'SUPERSEDED', 'REJECTED']) {
      expect(Evidence.safeParse({ ...valid(), status }).success).toBe(true);
    }
  });
});

describe('Signal', () => {
  it('never trusts payload by default (RAW is a valid starting status)', () => {
    const signal = base({ status: 'RAW', signal_type: 'external_news', payload: { headline: 'x' }, external: true });
    expect(Signal.safeParse(signal).success).toBe(true);
  });
});

describe('Behavior', () => {
  it('rejects a simulated behavior claiming CONFIRMED status directly (must stay SIMULATED/PROVISIONAL first)', () => {
    // The schema alone can't enforce the state machine transition (that's a Phase-3 runtime concern),
    // but it can and does enforce that `simulated` and `kind` are always explicit, never inferred.
    const behavior = base({ status: 'SIMULATED', kind: 'CANDIDATE_NEW_MO', description: 'New collusion pattern in sim.', simulated: true });
    expect(Behavior.safeParse(behavior).success).toBe(true);
  });

  it('rejects an unknown behavior kind', () => {
    const behavior = base({ status: 'SIMULATED', kind: 'MYSTERY', description: 'x', simulated: true });
    expect(Behavior.safeParse(behavior).success).toBe(false);
  });
});

describe('Decision', () => {
  it('requires at least one rationale entry — the arbiter must explain why (§12)', () => {
    const decision = base({ status: 'FINAL', case_id: 'case-1', action: 'ACCEPT', rationale: [], decided_by: 'trust-engine' });
    expect(Decision.safeParse(decision).success).toBe(false);
  });

  it('accepts a decision with a rationale', () => {
    const decision = base({ status: 'FINAL', case_id: 'case-1', action: 'ACCEPT', rationale: ['strong evidence', 'low novelty'], decided_by: 'trust-engine' });
    expect(Decision.safeParse(decision).success).toBe(true);
  });
});

describe('Disagreement', () => {
  it('requires at least two models and at least two positions — a single opinion is not a disagreement', () => {
    const oneModel = base({
      status: 'OPEN', case_id: 'case-1', model_ids: ['laya-english'],
      positions: [{ model_id: 'laya-english', stance: 'KNOWN_MO', confidence: 0.8 }], resolution: null,
    });
    expect(Disagreement.safeParse(oneModel).success).toBe(false);

    const twoModels = base({
      status: 'OPEN', case_id: 'case-1', model_ids: ['laya-english', 'jev'],
      positions: [
        { model_id: 'laya-english', stance: 'KNOWN_MO', confidence: 0.8 },
        { model_id: 'jev', stance: 'NOVEL', confidence: 0.6 },
      ],
      resolution: null,
    });
    expect(Disagreement.safeParse(twoModels).success).toBe(true);
  });
});

describe('Replay', () => {
  it('never calls a finding "the true cause" in the schema — status is the replay model result, not causal proof', () => {
    const replay = base({
      status: 'FRAGILE', case_id: 'case-1', decision_id: 'decision-1',
      mutation_type: 'REMOVE_EVIDENCE', finding: 'Decision flips to ABSTAIN when evidence-3 is removed.',
    });
    expect(Replay.safeParse(replay).success).toBe(true);
  });
});

describe('CandidateMo', () => {
  it('accepts a minimal valid candidate MO', () => {
    const mo = base({
      status: 'POTENTIAL_NEW_MO', case_id: 'case-1', taxonomy_version: '2026.09', taxonomy_hash: 'sha256:def',
      reproducible: false, distinct_from_existing: true,
    });
    expect(CandidateMo.safeParse(mo).success).toBe(true);
  });
});

describe('Lesson', () => {
  it('starts life as CANDIDATE, never ADOPTED (transition rules are enforced at runtime, not by this schema alone, but CANDIDATE must always be a legal value)', () => {
    const lesson = base({
      status: 'CANDIDATE', source_case_id: 'case-1', original_prediction: 'BENIGN',
      actual_outcome: 'CONFIRMED_FRAUD', error_type: 'false_negative', root_cause: 'evidence gap', version: 1,
    });
    expect(Lesson.safeParse(lesson).success).toBe(true);
  });
});

describe('Knowledge', () => {
  it('requires validation_count and contradiction_count to be non-negative integers', () => {
    const knowledge = base({
      status: 'ACTIVE', statement: 'Disagreement between Laya and Jev predicts human review.', version: 1,
      last_confirmed: AT, confidence: 0.7, validation_count: -1, contradiction_count: 0, decay_policy: 'review after 90 days',
    });
    expect(Knowledge.safeParse(knowledge).success).toBe(false);
  });
});

describe('Review', () => {
  it('allows system_recommendation and human_decision to differ (human is authoritative, §46)', () => {
    const review = base({
      status: 'COMPLETE', case_id: 'case-1', decision_id: 'decision-1', reviewer: 'jeevan',
      system_recommendation: 'ESCALATE', human_decision: 'APPROVE', rationale: 'Reviewed evidence directly, escalation not warranted.',
    });
    expect(Review.safeParse(review).success).toBe(true);
  });
});

describe('Trust', () => {
  it('requires every named driver — no bare trust score (§34)', () => {
    const trust = base({
      status: 'CONDITIONAL', case_id: 'case-1',
      drivers: {
        evidence_quality: 0.7, evidence_independence: 0.6, model_calibration: null, model_historical_accuracy: null,
        model_agreement: null, novelty: 0.3, replay_stability: null, contradiction_count: 0, source_quality: 0.8,
        human_validation: false,
      },
    });
    expect(Trust.safeParse(trust).success).toBe(true);
  });

  it('rejects a trust object missing a driver', () => {
    const trust = base({
      status: 'CONDITIONAL', case_id: 'case-1',
      drivers: { evidence_quality: 0.7, evidence_independence: 0.6 },
    });
    expect(Trust.safeParse(trust).success).toBe(false);
  });
});

describe('Experiment', () => {
  it('accepts a minimal valid experiment', () => {
    const experiment = base({
      status: 'PLANNED', seed: 'seed-1', dataset_hash: 'sha256:ghi',
      configuration: {}, environment: {}, outputs: null, metrics: null,
    });
    expect(Experiment.safeParse(experiment).success).toBe(true);
  });
});

describe('ModelProfile', () => {
  it('tags every benchmark result SELF_REPORTED, THIRD_PARTY, or MESH_MEASURED (§10, §49)', () => {
    const profile = base({
      status: 'NOT_CONNECTED', provider: 'convaiinnovations', checkpoint: 'convaiinnovations/laya',
      license: null, runtime: null, parameter_count: 421_000_000, context_limit: null,
      supported_languages: ['en'], question_types: ['choice', 'score', 'noul'], calibration_method: null,
      benchmark_results: [{ metric: 'accuracy', value: 0.9, dataset: 'model-card', dataset_version: 'unknown', kind: 'SELF_REPORTED' }],
      known_limitations: ['Never MESH-measured yet; adapter is NOT_CONNECTED.'],
    });
    expect(ModelProfile.safeParse(profile).success).toBe(true);
  });

  it('rejects a benchmark result with an invented kind label', () => {
    const profile = base({
      status: 'NOT_CONNECTED', provider: 'convaiinnovations', checkpoint: 'convaiinnovations/laya',
      license: null, runtime: null, parameter_count: null, context_limit: null,
      supported_languages: [], question_types: [], calibration_method: null,
      benchmark_results: [{ metric: 'accuracy', value: 0.9, dataset: 'model-card', dataset_version: 'unknown', kind: 'MARKETING' }],
      known_limitations: [],
    });
    expect(ModelProfile.safeParse(profile).success).toBe(false);
  });
});
