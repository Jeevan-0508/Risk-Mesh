import type { OlympusRun } from './olympus-pipeline';

function bullet(values: string[]): string {
  return values.length ? values.map((value) => `- ${value}`).join('\n') : '- None';
}

/** Render only data already present in the run; it never invents KPIs or claims compliance. */
export function renderOlympusReportMarkdown(run: OlympusRun): string {
  return [
    `# Olympus audit report: ${run.scenarioId}`,
    '',
    `- Decision: **${run.decision.action}**`,
    `- Trust: **${run.trust.status}**`,
    `- Replay: **${run.replay.status}**`,
    `- Human review: **${run.review.status}**`,
    '',
    '## Facts',
    '',
    bullet(run.report.facts),
    '',
    '## Interpretations and limits',
    '',
    bullet(run.report.interpretations),
    '',
    '## Recommendations',
    '',
    bullet(run.report.recommendations),
    '',
    '## Evidence and audit references',
    '',
    bullet(run.report.sourceIds.map((id) => '`' + id + '`')),
    '',
    'Generated from deterministic synthetic data. This report is not a legal conclusion or production assurance.',
    '',
  ].join('\n');
}

