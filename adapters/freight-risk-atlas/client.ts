/**
 * Reads freight-risk-atlas's real synced taxonomy from risk-swarm's own
 * `public/snapshots/freight-risk-atlas/taxonomy.json` (risk-swarm already syncs and hashes this —
 * see `../_shared/snapshot-provenance.ts`). MESH does not re-sync from freight-risk-atlas's own
 * repo directly, for the same reason as the FOMO adapter (Phase 0 audit finding: don't duplicate a
 * sync step an adapter already does in this ecosystem).
 */
import { readVerifiedSnapshotFile } from '../_shared/snapshot-provenance';

export interface TaxonomyMeta {
  taxonomy: string;
  version: string;
  pattern_count: number;
  categories: string[];
  indicator_count: number;
  countermeasure_count: number;
}

export interface TaxonomyPattern {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  severity: string;
  prevalence: string;
  modes: string[];
  geography: string[];
  summary: string;
  [key: string]: unknown;
}

export type TaxonomySnapshotResult =
  | { ok: true; status: 'SNAPSHOT'; meta: TaxonomyMeta; patterns: TaxonomyPattern[]; commit: string; sha256: string }
  | { ok: false; status: 'UNAVAILABLE'; error: string };

export async function readTaxonomySnapshot(snapshotsDir: string): Promise<TaxonomySnapshotResult> {
  const verified = await readVerifiedSnapshotFile(snapshotsDir, 'freight-risk-atlas', 'freight-risk-atlas/taxonomy.json');
  if (!verified.ok) return verified;

  let parsed: { meta?: unknown; patterns?: unknown };
  try {
    parsed = JSON.parse(verified.buffer.toString('utf-8'));
  } catch (error) {
    return { ok: false, status: 'UNAVAILABLE', error: `freight-risk-atlas/taxonomy.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!parsed.meta || typeof parsed.meta !== 'object') {
    return { ok: false, status: 'UNAVAILABLE', error: 'freight-risk-atlas/taxonomy.json has no meta object — sync shape may have changed' };
  }
  if (!Array.isArray(parsed.patterns)) {
    return { ok: false, status: 'UNAVAILABLE', error: 'freight-risk-atlas/taxonomy.json has no patterns array — sync shape may have changed' };
  }

  return {
    ok: true,
    status: 'SNAPSHOT',
    meta: parsed.meta as TaxonomyMeta,
    patterns: parsed.patterns as TaxonomyPattern[],
    commit: verified.source.commit,
    sha256: verified.file.sha256,
  };
}
