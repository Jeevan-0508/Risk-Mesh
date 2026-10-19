import { describe, expect, it } from 'bun:test';
import { renderOlympusReportMarkdown } from './olympus-report';
import { runOlympusScenario } from './olympus-pipeline';

describe('Olympus report renderer', () => {
  it('renders measured run data and explicit limitations', () => {
    const run = runOlympusScenario({
      id: 'report-001',
      aiSystem: { id: 'system-1', name: 'Synthetic Agent', purpose: 'Testing', impact: 'HIGH' },
      documents: [{ id: 'doc-1', name: 'policy.md', content: 'Human approval and audit trail logging.' }],
      now: '2026-10-19T12:00:00.000Z',
      reviewer: 'reviewer-1',
    });
    const report = renderOlympusReportMarkdown(run);
    expect(report).toContain('# Olympus audit report: report-001');
    expect(report).toContain('HUMAN_REVIEW');
    expect(report).toContain('not a legal conclusion');
    expect(report).not.toContain('undefined');
  });
});

