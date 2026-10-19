import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { policyAuditBundleToOlympusScenario, validatePolicyAuditBundle } from './adapter';

const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;

const bundle = {
  schema_version: '1.0',
  run_id: 'audit-run-001',
  created_at: '2026-10-19T12:00:00.000Z',
  system: { id: 'claims-agent', name: 'ClaimsAgent', purpose: 'Synthetic claims triage', impact: 'HIGH' as const },
  documents: [{ id: 'doc-1', filename: 'policy.md', content: 'Human approval and audit logging are required.', content_hash: hash('Human approval and audit logging are required.'), source_ref: 'policy.md#human-oversight' }],
  evidence: [{ id: 'e-1', document_id: 'doc-1', source_ref: 'policy.md#human-oversight', statement: 'Human approval is required.', classification_method: 'deterministic' as const, status: 'SUPPORTED' as const }],
  findings: [{ id: 'f-1', type: 'EVIDENCE_GAP', severity: 'HIGH' as const, status: 'MISSING' as const, requirement_ids: ['EUAIA-14'], evidence_ids: [], reasoning: 'The override procedure is not evidenced.', uncertainty: 'Missing evidence is not confirmed noncompliance.' }],
  framework_ids: ['eu-ai-act'],
};

describe('POLICY//AUDIT adapter', () => {
  it('accepts a versioned bundle and preserves source metadata', () => {
    expect(validatePolicyAuditBundle(bundle)).toBe(true);
    const intake = policyAuditBundleToOlympusScenario(bundle, 'reviewer-1');
    expect(intake.scenario.documents[0]?.sourceType).toBe('policy-audit:policy.md#human-oversight');
    expect(intake.sourceFindingIds).toEqual(['f-1']);
    expect(intake.frameworkIds).toEqual(['eu-ai-act']);
  });

  it('rejects a finding without uncertainty or a source document', () => {
    const invalid = { ...bundle, findings: [{ ...bundle.findings[0], uncertainty: '' }] };
    expect(validatePolicyAuditBundle(invalid)).toBe(false);
    expect(() => policyAuditBundleToOlympusScenario(invalid, 'reviewer-1')).toThrow();
  });
});

