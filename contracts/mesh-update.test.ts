import { describe, expect, it } from 'bun:test';
import { MeshUpdate } from './mesh-update';

const base = {
  id: 'fomo:briefing',
  sourceProject: 'FOMO',
  timestamp: '2026-10-04T08:00:00.000Z',
  title: 'New external freight-risk signals',
  summary: 'Two external signals were added.',
  category: 'risk-intelligence',
  importance: 'high',
  evidenceType: 'EXTERNAL_SOURCE',
  sourceType: 'REAL_WORLD',
  links: [{ label: 'Original report', url: 'https://example.com/report' }],
  provenance: { status: 'SNAPSHOT', contentHash: 'sha256:test' },
  details: { records: [{ id: 'report-1' }] },
  status: 'NEW',
  fingerprint: 'sha256:test',
};

describe('MeshUpdate', () => {
  it('accepts a grounded external update with source provenance', () => {
    expect(MeshUpdate.safeParse(base).success).toBe(true);
  });

  it('keeps synthetic labels explicit instead of flattening them into real evidence', () => {
    const parsed = MeshUpdate.parse({ ...base, sourceProject: 'Fraud Watch', evidenceType: 'SIMULATION', sourceType: 'SYNTHETIC' });
    expect(parsed.sourceType).toBe('SYNTHETIC');
    expect(parsed.evidenceType).toBe('SIMULATION');
  });

  it('rejects missing links and invalid lifecycle status', () => {
    expect(MeshUpdate.safeParse({ ...base, links: [], status: 'MAYBE' }).success).toBe(false);
    expect(MeshUpdate.safeParse({ ...base, timestamp: 'not-a-date' }).success).toBe(false);
  });
});
