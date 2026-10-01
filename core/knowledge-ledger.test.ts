import { describe, expect, it } from 'bun:test';
import { KnowledgeLedger, IllegalKnowledgeTransitionError } from './knowledge-ledger';
import { Ledger } from './ledger';
import { validationFixture, VERIFIED_AT as AT } from './__fixtures__/validation-fixture';

function setup() {
  const fixture = validationFixture(); const ledger = new Ledger();
  const knowledge = new KnowledgeLedger(ledger); const permit = fixture.permit();
  return { knowledge, ledger, permit };
}
describe('KnowledgeLedger controlled adoption', () => {
  it('records approved claims with unknown probability and bound provenance', () => {
    const { knowledge, ledger, permit } = setup(); const item = knowledge.recordApproved(permit);
    expect(item.confidence).toBeNull(); expect(item.validation_count).toBe(2);
    expect(item.provenance.upstream_ref).toBe(permit.validation_bundle_sha256);
    expect(ledger.ofType('KNOWLEDGE_ADOPTED')).toHaveLength(1);
  });
  it('rejects bare records, invented confidence and claim substitution', () => {
    const { knowledge, permit } = setup(); const item = knowledge.recordApproved(permit);
    const other = new KnowledgeLedger(new Ledger());
    expect(() => other.record(item)).toThrow('permit');
    expect(() => other.record({ ...item, confidence: .99 }, permit)).toThrow('calibrated');
    expect(() => other.record({ ...item, statement: 'A substituted claim.' }, permit)).toThrow('another');
    expect(() => other.record({ ...item, provenance: { ...item.provenance, source: 'SIMULATED' } }, permit)).toThrow('Synthetic');
  });
  it('requires newer validation for reconfirmation and keeps rejected mutations atomic', () => {
    const { knowledge, ledger, permit } = setup(); knowledge.recordApproved(permit);
    knowledge.transition('know-1', 'STALE', 'source changed', AT);
    expect(() => knowledge.transition('know-1', 'ACTIVE', 'reuse old review', AT, permit)).toThrow('newer');
    expect(knowledge.get('know-1')?.status).toBe('STALE');
    expect(ledger.ofType('KNOWLEDGE_STATUS_CHANGED')).toHaveLength(1);
  });
  it('records contradictions and never silently restores contradicted knowledge', () => {
    const { knowledge, permit } = setup(); knowledge.recordApproved(permit);
    expect(knowledge.recordContradiction('know-1', 'source disagrees', AT).contradiction_count).toBe(1);
    expect(() => knowledge.transition('know-1', 'ACTIVE', 'ignore', AT, permit)).toThrow(IllegalKnowledgeTransitionError);
    knowledge.transition('know-1', 'SUPERSEDED', 'reviewed replacement', AT);
    expect(() => knowledge.recordContradiction('know-1', 'late change', AT)).toThrow(IllegalKnowledgeTransitionError);
    expect(knowledge.get('know-1')?.contradiction_count).toBe(1);
  });
  it('protects stored objects and audit history from caller mutation', () => {
    const { knowledge, ledger, permit } = setup(); const item = knowledge.recordApproved(permit);
    item.status = 'SUPERSEDED'; item.provenance.upstream_ref = 'forged';
    knowledge.list()[0]!.statement = 'forged'; ledger.list()[0]!.detail = 'forged';
    expect(knowledge.get('know-1')?.status).toBe('ACTIVE');
    expect(knowledge.get('know-1')?.statement).toBe(permit.candidate.statement);
    expect(ledger.list()[0]!.detail).toContain(permit.validation_bundle_sha256);
  });
});
