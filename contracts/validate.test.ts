import { describe, expect, it } from 'bun:test';
import { validateMeshObject, MESH_OBJECT_KINDS } from './validate';

const AT = '2026-09-23T10:00:00.000Z';
const base = (overrides: Record<string, unknown> = {}) => ({
  id: 'x-1',
  schema_version: '1.0',
  created_at: AT,
  source: 'test-fixture',
  provenance: { source: 'SNAPSHOT', system: 'test-fixture', retrieved_at: AT, upstream_ref: null, note: null },
  status: 'placeholder',
  ...overrides,
});

describe('validateMeshObject', () => {
  it('covers all 17 contract kinds from spec §3, plus the repository registry (Ask MESH directive)', () => {
    expect(MESH_OBJECT_KINDS.length).toBe(18);
  });

  it('rejects garbage for every kind rather than silently coercing it', () => {
    for (const kind of MESH_OBJECT_KINDS) {
      const result = validateMeshObject(kind, { not: 'a mesh object' });
      expect(result.ok).toBe(false);
    }
  });

  it('accepts a real evidence object and returns readable errors for a bad one', () => {
    const good = validateMeshObject('evidence', base({
      status: 'UNVERIFIED', source_type: 'news', observed_at: AT, content_hash: 'sha256:abc', reliability: 0.5, independent: true,
    }));
    expect(good.ok).toBe(true);

    const bad = validateMeshObject('evidence', base({
      status: 'UNVERIFIED', source_type: 'news', observed_at: AT, content_hash: 'sha256:abc', reliability: 2, independent: true,
    }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.some((e) => e.includes('reliability'))).toBe(true);
  });
});
