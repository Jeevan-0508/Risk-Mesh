import { describe, expect, it } from 'bun:test';
import { callModel } from './client';

describe('callModel', () => {
  it('fails closed with NOT_CONNECTED for every real registry entry, never returning a ModelResult', async () => {
    for (const modelId of ['laya-english', 'laya-multilingual', 'laya-typed', 'jev', 'open-jev']) {
      const result = await callModel(modelId, {});
      expect(result.ok).toBe(false);
      expect(result.status).toBe('NOT_CONNECTED');
    }
  });

  it('fails closed with UNAVAILABLE, not NOT_CONNECTED, for an id not in the registry at all', async () => {
    const result = await callModel('gpt-not-a-real-mesh-entry', {});
    expect(result.ok).toBe(false);
    expect(result.status).toBe('UNAVAILABLE');
  });

  it('the NOT_CONNECTED reason names the actual missing dependency, not a generic message', async () => {
    const laya = await callModel('laya-english', {});
    if (laya.ok) throw new Error('unreachable');
    expect(laya.reason).toContain('HuggingFace');

    const jev = await callModel('jev', {});
    if (jev.ok) throw new Error('unreachable');
    expect(jev.reason).toContain('Jev API key');
  });
});
