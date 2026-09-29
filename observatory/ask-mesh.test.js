import { describe, expect, it } from 'bun:test';
import { buildMeshContext, buildSystemPrompt } from './ask-mesh.js';

describe('Ask MESH epistemic boundary', () => {
  const cases = [{
    title: 'System-1 Simulation Case',
    case_id: 'case-synthetic-1',
    summary: 'A generated simulation case.',
    events: [],
    blocked_attempt: null,
    ground_truth: {
      status: 'SIMULATED',
      classification: 'SYNTHETIC_PATTERN',
      confidence: 0.8,
      confidenceBand: 'high',
      noveltyScore: 0.1,
      signature: 'test-signature',
      entities: {},
      timeline: [],
      evidence: [],
    },
  }];

  it('marks replay records synthetic and distinguishes simulator answer keys', () => {
    const context = buildMeshContext(cases);
    expect(context).toContain('data_class: simulation_test_fixture');
    expect(context).toContain('SIMULATION GROUND TRUTH');
    expect(context).toContain('not a real-world investigation');
  });

  it('instructs the model to abstain and forbids extrapolation to actual incidents', () => {
    const prompt = buildSystemPrompt(buildMeshContext(cases), 'fixture registry');
    expect(prompt).toContain("say 'I don't know' or 'evidence is insufficient'");
    expect(prompt).toContain('Never present those labels as real-world facts');
    expect(prompt).toContain('actual carriers, incidents, prevalence, or fraud patterns');
  });
});
