import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBriefing, recordDiff, stableStringify } from './build-briefing.mjs';

test('stableStringify is independent of object insertion order', () => {
  assert.equal(stableStringify({ b: 2, a: 1 }), stableStringify({ a: 1, b: 2 }));
});

test('recordDiff distinguishes new, updated and unchanged records', () => {
  assert.deepEqual(recordDiff({ a: '1', b: '1' }, { a: '2', b: '1', c: '1' }), {
    added: ['c'], updated: ['a'], changed: ['c', 'a'],
  });
});

test('the current seven-source snapshot normalizes provenance and evidence classes', async () => {
  const result = await buildBriefing({ now: '2026-10-04T08:00:00.000Z' });
  assert.equal(result.payload.sources.length, 7);
  assert.ok(result.payload.sources.every((source) => source.name && source.status));
  const fomo = result.payload.sources.find((source) => source.id === 'fomo');
  const fraud = result.payload.sources.find((source) => source.id === 'fraud-watch');
  const eu = result.payload.sources.find((source) => source.id === 'eu-ai-act-scanner');
  const fomoUpdate = result.payload.updates.find((update) => update.sourceProject === 'FOMO');
  assert.equal(fomo.sourceType, 'REAL_WORLD');
  assert.equal(fraud.sourceType, 'SYNTHETIC');
  assert.equal(eu.sourceType, 'OFFICIAL');
  assert.ok(fomo.trust.includes('repository snapshot'));
  assert.ok(fraud.trust.includes('not real incidents'));
  assert.ok(eu.trust.includes('human review'));
  assert.equal(fomoUpdate.details.records.length, fomoUpdate.details.recordCount);
  assert.ok(fomoUpdate.details.records.every((record) => record.links.every((item) => item.url)));
});

test('a second build against unchanged source outputs is a no-change operation', async () => {
  const result = await buildBriefing({ now: '2026-10-04T08:00:01.000Z' });
  assert.equal(result.changed, false);
  assert.ok(result.payload.updates.every((update) => update.id.endsWith(':briefing')));
});
