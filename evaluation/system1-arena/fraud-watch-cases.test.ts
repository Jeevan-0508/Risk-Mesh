import { describe, expect, it } from 'bun:test';
import { behaviorToLayaState, arenaComparisonToSystem1Input, evaluateBehaviorViaSystem1, CARRIER_BEHAVIOR_QUESTION } from './fraud-watch-cases';
import type { LayaRuntimeResult, LayaInferenceInput } from '../../adapters/model-registry/laya-runtime';
import type { Behavior } from '../../contracts/schemas';
import fraudWatchFixture from '../../adapters/model-registry/__fixtures__/laya-typed-fraud-watch-mo0001-call.json';

const MO_0001_BEHAVIOR: Behavior = {
  id: 'fraud-watch-behavior-MO-0001',
  schema_version: '1.0',
  created_at: '2026-09-23T10:00:00.000Z',
  source: 'fraud-watch-adapter',
  provenance: {
    source: 'SIMULATED',
    system: 'fraud-watch',
    retrieved_at: '2026-09-23T10:00:00.000Z',
    upstream_ref: 'fraud-watch/data/world-state.json',
    note: 'fraud-watch classification=EMERGING_BEHAVIOR, status=NEW, confidenceBand=MINIMAL, noveltyScore=100, recurrenceCount=1',
  },
  status: 'SIMULATED',
  case_id: 'case-fraud-watch-demo',
  kind: 'EMERGING_BEHAVIOR',
  description: 'fraud-watch MO MO-0001: signature EQUIPMENT_CARRIER_MISMATCH+FALSE_MILESTONE_STAMP+HANDOVER_GAP+MANIFEST_CHANGED (truckId=TRU-023, driverId=DRI-023, trailerId=TRA-023, carrierId=CAR-007)',
  simulated: true,
};

const fakeLayaRunner = (input: LayaInferenceInput): LayaRuntimeResult => {
  const fixtureAnswer = (fraudWatchFixture as any).output.result.answers.carrier_behavior_call;
  return {
    ok: true,
    load_seconds: 1,
    infer_seconds: 0.1,
    result: { model: 'laya-rl-agent', answers: { q: fixtureAnswer }, usage: { input_tokens: 214, output_tokens: 0 } },
  };
};

const disagreeingRunner = (input: LayaInferenceInput): LayaRuntimeResult => {
  if (input.checkpoint === 'convaiinnovations/laya-typed-decisions') return fakeLayaRunner(input);
  return {
    ok: true,
    load_seconds: 1,
    infer_seconds: 0.1,
    result: { model: 'laya-rl-agent', answers: { q: { type: 'choice', choice: 'normal', probabilities: { normal: 0.7, investigate: 0.1, inconclusive: 0.2 }, confidence: 0.5 } }, usage: { input_tokens: 200, output_tokens: 0 } },
  };
};

const FIXED_NOW = () => '2026-09-23T12:00:00.000Z';
const ANY_SYSTEM1_CONTEXT = { swarmAvailable: false, jevAvailable: false, caseRisk: 'STANDARD' as const };

describe('behaviorToLayaState', () => {
  it('matches the real captured fixture\'s state text exactly for MO-0001 - never diverges from what was actually sent to Laya', () => {
    const state = behaviorToLayaState(MO_0001_BEHAVIOR);
    expect(state).toBe((fraudWatchFixture as any).input.state);
  });

  it('never includes fraud-watch\'s own confidence/confidenceBand/noveltyScore/investigation fields, only description', () => {
    const state = behaviorToLayaState(MO_0001_BEHAVIOR);
    expect(state).not.toContain('confidenceBand');
    expect(state).not.toContain('noveltyScore');
    expect(state).not.toContain('MINIMAL');
  });
});

describe('CARRIER_BEHAVIOR_QUESTION', () => {
  it('matches the real captured fixture\'s question exactly', () => {
    expect(CARRIER_BEHAVIOR_QUESTION).toEqual((fraudWatchFixture as any).input.questions.carrier_behavior_call);
  });
});

describe('arenaComparisonToSystem1Input', () => {
  it('maps a real agreement comparison to a null disagreement, preserving the score', () => {
    const input = arenaComparisonToSystem1Input([], { agreement: true, model_agreement_score: 0.9 });
    expect(input).toEqual({ results: [], modelAgreementScore: 0.9, disagreement: null });
  });
});

describe('evaluateBehaviorViaSystem1', () => {
  it('runs a real fraud-watch Behavior end to end through the Arena and decideSystem1Action, agreeing checkpoints -> ACCEPT_SYSTEM1', async () => {
    const result = await evaluateBehaviorViaSystem1(
      MO_0001_BEHAVIOR,
      ['laya-typed', 'laya-english'],
      ANY_SYSTEM1_CONTEXT,
      { layaRunner: fakeLayaRunner, now: FIXED_NOW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.arena.results).toHaveLength(2);
    expect(result.arena.results[0]?.decision).toBe('investigate');
    expect(result.system1Decision.action).toBe('ACCEPT_SYSTEM1');
  });

  it('routes a real disagreement between checkpoints to ESCALATE_TO_SWARM when the swarm is reachable', async () => {
    const result = await evaluateBehaviorViaSystem1(
      MO_0001_BEHAVIOR,
      ['laya-typed', 'laya-english'],
      { ...ANY_SYSTEM1_CONTEXT, swarmAvailable: true },
      { layaRunner: disagreeingRunner, now: FIXED_NOW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.system1Decision.action).toBe('ESCALATE_TO_SWARM');
  });

  it('fails closed with the Arena\'s own real failure reason when fewer than 2 requested models are actually connected', async () => {
    const result = await evaluateBehaviorViaSystem1(
      MO_0001_BEHAVIOR,
      ['laya-typed', 'jev'],
      ANY_SYSTEM1_CONTEXT,
      { layaRunner: fakeLayaRunner, now: FIXED_NOW },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toContain('only 1 of 2');
    if (result.arena.ok) throw new Error('unreachable');
    expect(result.arena.failures.join(' ')).toContain('jev');
  });

  it('never leaks fraud-watch\'s hidden confidence/investigation fields into the state Laya actually receives', async () => {
    let capturedState: string | Record<string, unknown> | unknown[] | undefined;
    const capturingRunner = (input: LayaInferenceInput): LayaRuntimeResult => {
      capturedState = input.state;
      return fakeLayaRunner(input);
    };
    await evaluateBehaviorViaSystem1(MO_0001_BEHAVIOR, ['laya-typed', 'laya-english'], ANY_SYSTEM1_CONTEXT, { layaRunner: capturingRunner, now: FIXED_NOW });
    expect(typeof capturedState).toBe('string');
    expect(capturedState as string).not.toContain('confidenceBand');
  });
});
