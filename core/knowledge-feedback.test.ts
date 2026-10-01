import { describe, it, expect } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promoteKnowledge } from './knowledge-feedback';
import { validationFixture, VERIFIED_AT } from './__fixtures__/validation-fixture';
import { digest } from './controlled-validation';

describe('durable controlled feedback', () => {
  it('appends sequential signed versions, refuses duplicates and preserves old bytes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mesh-feedback-'));
    try {
      const first = validationFixture(); const saved = promoteKnowledge(first.bundle, first.policy, dir, VERIFIED_AT);
      const bytes = readFileSync(saved.path, 'utf8');
      expect(saved.package.knowledge.confidence).toBeNull();
      expect(() => promoteKnowledge(first.bundle, first.policy, dir, VERIFIED_AT)).toThrow('Version');
      const second = validationFixture({ version: 2, previous_version: 1 });
      const next = promoteKnowledge(second.bundle, second.policy, dir, VERIFIED_AT);
      expect(next.package.previous_package_sha256).toBe(saved.package.package_sha256);
      expect(readFileSync(saved.path, 'utf8')).toBe(bytes);
    } finally { rmSync(dir, { recursive: true }); }
  });
  it('detects tampered history even when its untrusted local hash was recomputed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mesh-feedback-'));
    try {
      const first = validationFixture(); const saved = promoteKnowledge(first.bundle, first.policy, dir, VERIFIED_AT);
      const { package_sha256: _, ...forged } = saved.package;
      forged.knowledge.statement = 'Forged replacement for an approved claim.';
      writeFileSync(saved.path, JSON.stringify({ ...forged, package_sha256: digest(forged) }));
      const next = validationFixture({ version: 2, previous_version: 1 });
      expect(() => promoteKnowledge(next.bundle, next.policy, dir, VERIFIED_AT)).toThrow('not bound');
    } finally { rmSync(dir, { recursive: true }); }
  });
});
