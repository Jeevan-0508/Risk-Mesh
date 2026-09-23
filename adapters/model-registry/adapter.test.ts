import { describe, expect, it } from 'bun:test';
import { assessModelCall, getModelRegistry, registryStatusSummary } from './adapter';

describe('assessModelCall', () => {
  it('never returns ok:true — no ModelResult can honestly be produced yet', async () => {
    const result = await assessModelCall('laya-english', {});
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('NOT_CONNECTED');
  });
});

describe('registryStatusSummary / getModelRegistry', () => {
  it('reports all 5 real registry entries as NOT_CONNECTED', () => {
    const summary = registryStatusSummary();
    expect(summary).toHaveLength(5);
    expect(summary.every((s) => s.status === 'NOT_CONNECTED')).toBe(true);
  });

  it('getModelRegistry is re-exported unchanged from registry.ts', () => {
    expect(getModelRegistry()).toHaveLength(5);
  });
});
