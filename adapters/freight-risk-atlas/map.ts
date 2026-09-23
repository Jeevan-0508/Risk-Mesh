/**
 * Connects a verified taxonomy snapshot to MESH's `CandidateMo` contract (spec §17):
 * `taxonomy_version`/`taxonomy_hash` are read straight from risk-swarm's already hash-verified
 * record, not recomputed a second time — the same "reuse, don't re-derive" decision as the client.
 * `findPatternById`/`findPatternsByCategory` are plain lookups for whatever future
 * `distinct_from_existing` check consumes this adapter; they do no fuzzy matching or invention.
 */
import type { TaxonomyMeta, TaxonomyPattern, TaxonomySnapshotResult } from './client';

export interface TaxonomyVersionRecord {
  taxonomy_version: string;
  taxonomy_hash: string;
}

export function taxonomyVersionRecord(result: Extract<TaxonomySnapshotResult, { ok: true }>): TaxonomyVersionRecord {
  return { taxonomy_version: result.meta.version, taxonomy_hash: result.sha256 };
}

export function findPatternById(patterns: TaxonomyPattern[], id: string): TaxonomyPattern | undefined {
  return patterns.find((p) => p.id === id);
}

export function findPatternsByCategory(patterns: TaxonomyPattern[], category: string): TaxonomyPattern[] {
  return patterns.filter((p) => p.category === category);
}

export function summarizeMeta(meta: TaxonomyMeta): string {
  return `${meta.taxonomy} v${meta.version}: ${meta.pattern_count} patterns, ${meta.indicator_count} indicators, ${meta.countermeasure_count} countermeasures`;
}
