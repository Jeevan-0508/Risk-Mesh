/**
 * Reads FOMO's real synced signals from risk-swarm's own `public/snapshots/fomo/signals.json`
 * (risk-swarm already syncs this, hash-verified — see `../_shared/snapshot-provenance.ts`). MESH
 * does not re-sync from FOMO's own repo directly; that would duplicate work an adapter already does
 * in this ecosystem (Phase 0 audit finding), and risk-swarm's copy is already the vetted one.
 */
import { readVerifiedSnapshotFile } from '../_shared/snapshot-provenance';

export interface FomoSignal {
  category: string;
  title: string;
  link: string;
  source: string;
  pub_date: string;
  severity: string;
  found_at: string;
}

export type FomoSnapshotResult =
  | { ok: true; status: 'SNAPSHOT'; signals: FomoSignal[]; commit: string }
  | { ok: false; status: 'UNAVAILABLE'; error: string };

export async function readFomoSnapshot(snapshotsDir: string): Promise<FomoSnapshotResult> {
  const verified = await readVerifiedSnapshotFile(snapshotsDir, 'fomo', 'fomo/signals.json');
  if (!verified.ok) return verified;

  let parsed: { signals?: unknown };
  try {
    parsed = JSON.parse(verified.buffer.toString('utf-8'));
  } catch (error) {
    return { ok: false, status: 'UNAVAILABLE', error: `fomo/signals.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!Array.isArray(parsed.signals)) {
    return { ok: false, status: 'UNAVAILABLE', error: 'fomo/signals.json has no signals array — FOMO/risk-swarm\'s sync shape may have changed' };
  }

  return { ok: true, status: 'SNAPSHOT', signals: parsed.signals as FomoSignal[], commit: verified.source.commit };
}
