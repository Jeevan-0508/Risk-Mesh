/**
 * Composes `client.ts` (hash-verified snapshot read) and `map.ts` (taxonomy-version connection
 * point) into the entry point a case engine would call before filing a `CandidateMo`. Every exit
 * path is discriminated; there is no path that returns taxonomy data or a version record built
 * from anything other than a real, hash-verified freight-risk-atlas snapshot.
 */
import { readTaxonomySnapshot } from './client';
import { taxonomyVersionRecord, type TaxonomyVersionRecord } from './map';
import type { TaxonomyMeta, TaxonomyPattern } from './client';

export type TaxonomyAssessment =
  | { ok: true; meta: TaxonomyMeta; patterns: TaxonomyPattern[]; versionRecord: TaxonomyVersionRecord }
  | { ok: false; reason: string };

export async function assessTaxonomy(snapshotsDir: string): Promise<TaxonomyAssessment> {
  const result = await readTaxonomySnapshot(snapshotsDir);
  if (!result.ok) {
    return { ok: false, reason: `freight-risk-atlas UNAVAILABLE: ${result.error}` };
  }
  return { ok: true, meta: result.meta, patterns: result.patterns, versionRecord: taxonomyVersionRecord(result) };
}
