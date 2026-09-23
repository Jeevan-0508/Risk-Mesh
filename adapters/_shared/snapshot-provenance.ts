/**
 * Verifies a file against risk-swarm's own already-computed sha256 record in its
 * `public/snapshots/provenance.json`, rather than re-hashing independently as a second, potentially
 * diverging source of truth (per INTEGRATION_MATRIX.md's stated plan for the taxonomy adapters).
 * Mirrors the exact hashing call risk-swarm's own `scripts/sync-snapshots.mjs` uses
 * (`createHash('sha256').update(buf).digest('hex')`), so a match here means the same fact risk-swarm
 * itself already verified, not a new judgement MESH invented.
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export interface SnapshotProvenanceFile {
  upstream_path: string;
  path: string;
  bytes: number;
  sha256: string;
}
export interface SnapshotProvenanceSource {
  key: string;
  upstream_repo: string;
  upstream_url: string;
  commit: string;
  note: string;
  files: SnapshotProvenanceFile[];
}
export interface SnapshotProvenance {
  schema_version: string;
  synced_at: string;
  synced_by: string;
  sources: SnapshotProvenanceSource[];
}

export type VerifiedSnapshotFile =
  | { ok: true; status: 'SNAPSHOT'; buffer: Buffer; source: SnapshotProvenanceSource; file: SnapshotProvenanceFile }
  | { ok: false; status: 'UNAVAILABLE'; error: string };

function msg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function readVerifiedSnapshotFile(snapshotsDir: string, sourceKey: string, relativePath: string): Promise<VerifiedSnapshotFile> {
  let provenanceRaw: string;
  try {
    provenanceRaw = await readFile(`${snapshotsDir}/provenance.json`, 'utf-8');
  } catch (error) {
    return { ok: false, status: 'UNAVAILABLE', error: `cannot read ${snapshotsDir}/provenance.json: ${msg(error)}` };
  }

  let provenance: SnapshotProvenance;
  try {
    provenance = JSON.parse(provenanceRaw);
  } catch (error) {
    return { ok: false, status: 'UNAVAILABLE', error: `${snapshotsDir}/provenance.json is not valid JSON: ${msg(error)}` };
  }

  const source = provenance.sources?.find((s) => s.key === sourceKey);
  if (!source) return { ok: false, status: 'UNAVAILABLE', error: `provenance.json has no source keyed "${sourceKey}"` };

  const file = source.files?.find((f) => f.path === relativePath);
  if (!file) return { ok: false, status: 'UNAVAILABLE', error: `provenance.json's "${sourceKey}" source has no file record for "${relativePath}"` };

  let buffer: Buffer;
  try {
    buffer = await readFile(`${snapshotsDir}/${relativePath}`);
  } catch (error) {
    return { ok: false, status: 'UNAVAILABLE', error: `cannot read ${snapshotsDir}/${relativePath}: ${msg(error)}` };
  }

  const actual = createHash('sha256').update(buffer).digest('hex');
  if (actual !== file.sha256) {
    return { ok: false, status: 'UNAVAILABLE', error: `hash mismatch for ${relativePath}: provenance.json says ${file.sha256}, file is actually ${actual}` };
  }

  return { ok: true, status: 'SNAPSHOT', buffer, source, file };
}
