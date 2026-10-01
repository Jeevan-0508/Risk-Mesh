import test from 'node:test';
import assert from 'node:assert/strict';
import snapshot from './data/repository-state.js';
import { queryRepositoryState } from './repository-query.js';
test('catalogue query exposes committed sources, qualitative severity and null confidence', () => {
  const result = queryRepositoryState('What are the highest risk freight fraud patterns?', snapshot);
  assert.ok(result.evidence.length); assert.equal(result.confidence, null);
  assert.match(result.answer, /real-world risk ranking is unknown/);
  assert.ok(result.sources.every(s => /^[a-f0-9]{40}$/.test(s.revision) && /^[a-f0-9]{64}$/.test(s.sha256)));
});
test('unsupported trend, outcome and model questions abstain', () => {
  for (const question of ['Which fraud patterns increased recently?', 'What does SWARM think?', 'What outcome occurred?', 'Who will win tomorrow?']) {
    assert.equal(queryRepositoryState(question, snapshot).status, 'unknown');
  }
});
test('governance references remain authored mappings with unknown applicability', () => {
  const result = queryRepositoryState('Which GDPR controls cover this risk?', snapshot);
  assert.ok(result.evidence.length); assert.match(result.answer, /in practice is unknown/);
  assert.equal(result.evidence[0].data_class, 'internal_control_mapping');
});
test('synthetic context never becomes evidence, and model output remains unverified', () => {
  const handoff = { capture: { source: { repository: 'test', revision: null }, captured_at: '2026-09-30T00:00:00Z',
    research: { run_id: 'r', source_records: [] }, hypothesis_context: { candidate: { secret: 'hypothesis only' } } } };
  const result = queryRepositoryState('What evidence supports the candidate?', snapshot, handoff);
  assert.equal(result.evidence.length, 0); assert.equal(result.status, 'unknown');
  assert.ok(result.uncertainty.some(s => s.includes('synthetic')));
});
