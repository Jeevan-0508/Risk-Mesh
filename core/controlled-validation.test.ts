import { describe, expect, it } from 'bun:test';
import { validationFixture, VERIFIED_AT } from './__fixtures__/validation-fixture';
import { digest, parseBoundedJson, requireValidationPermit, verifyKnowledgeValidation } from './controlled-validation';

describe('controlled knowledge validation', () => {
  it('requires independent signed reviews and subsequent regression bound to the exact candidate/version', () => {
    const fixture = validationFixture();
    const permit = fixture.permit();
    expect(permit.reviewer_ids).toEqual(['reviewer-1', 'reviewer-2']);
    expect(permit.validation_bundle_sha256).toBe(digest(fixture.bundle));
    expect(() => requireValidationPermit(permit, fixture.candidate)).not.toThrow();
  });
  it('rejects synthetic-only, model-only, missing, disputed and unresolved evidence', () => {
    for (const kind of ['synthetic_simulation', 'model_output'] as const) {
      const fixture = validationFixture();
      const next = validationFixture({ evidence: fixture.candidate.evidence.map(e => ({ ...e, data_class: kind })) });
      expect(next.permit).toThrow('cannot validate');
    }
    expect(validationFixture({ scope: 'simulation_only' }).permit).toThrow('provisional');
    expect(validationFixture({ supporting_evidence_ids: [] }).permit).toThrow('insufficient');
    expect(validationFixture({ contradicting_evidence_ids: ['external-1'] }).permit).toThrow('disagreement');
    expect(validationFixture({ unresolved_questions: ['Was this source actually authenticated?'] }).permit).toThrow('uncertainty');
  });
  it('rejects unknown keys, forged signatures, model agreement and altered claim text', () => {
    const fixture = validationFixture();
    const forged = structuredClone(fixture.bundle);
    forged.reviews[0]!.signature = 'A'.repeat(86) + '==';
    expect(() => verifyKnowledgeValidation(forged, fixture.policy, VERIFIED_AT)).toThrow('signature');
    const untrusted = structuredClone(fixture.policy);
    untrusted.keys = [];
    expect(() => verifyKnowledgeValidation(fixture.bundle, untrusted, VERIFIED_AT)).toThrow('Unknown');
    expect(() => verifyKnowledgeValidation({ ...fixture.bundle, model_agreement: 1 }, fixture.policy, VERIFIED_AT)).toThrow();
    const altered = structuredClone(fixture.bundle);
    altered.candidate.statement = 'An unsupported replacement statement after human approval.';
    expect(() => verifyKnowledgeValidation(altered, fixture.policy, VERIFIED_AT)).toThrow('another candidate');
  });
  it('rejects author self-review and two keys mapped to the same reviewer', () => {
    expect(validationFixture({ author_id: 'reviewer-1' }).permit).toThrow('own candidate');
    const fixture = validationFixture();
    fixture.policy.keys[1]!.actor_id = fixture.policy.keys[0]!.actor_id;
    expect(fixture.permit).toThrow('distinct');
  });
  it('binds evidence bytes and prevents mutable or manufactured permits', () => {
    const fixture = validationFixture();
    const changed = structuredClone(fixture.bundle);
    changed.candidate.evidence[0]!.content += ' changed';
    expect(() => verifyKnowledgeValidation(changed, fixture.policy, VERIFIED_AT)).toThrow('hash');
    const permit = fixture.permit();
    permit.candidate.statement = 'Mutated after verification';
    expect(() => requireValidationPermit(permit, fixture.candidate)).toThrow('unmodified');
    expect(() => requireValidationPermit({ ...permit }, fixture.candidate)).toThrow('verified');
  });
  it('rejects expired approvals, bad chronology and version skips', () => {
    const fixture = validationFixture();
    expect(() => verifyKnowledgeValidation(fixture.bundle, fixture.policy, '2026-12-01T00:00:00Z')).toThrow('expiry');
    expect(() => verifyKnowledgeValidation(fixture.bundle, fixture.policy, '2026-09-30T09:00:00Z')).toThrow('chronology');
    expect(validationFixture({ version: 3 }).permit).toThrow('exactly once');
  });
  it('rejects oversized, nested, prototype-polluting and non-JSON data', () => {
    expect(() => parseBoundedJson(' '.repeat(2_000_001))).toThrow('2 MB');
    expect(() => parseBoundedJson('{"__proto__": {"trusted": true}}')).toThrow('Unsafe');
    expect(() => parseBoundedJson('['.repeat(34) + '0' + ']'.repeat(34))).toThrow('nesting');
    expect(() => digest({ missing: undefined })).toThrow('JSON');
  });
});
