/**
 * Composes `client.ts` (hash-verified snapshot read) and `map.ts` (translation) into the entry
 * point a case engine would call. Every exit path is discriminated; there is no path that returns a
 * `Signal[]` built from anything other than a real, hash-verified FOMO snapshot.
 */
import { readFomoSnapshot } from './client';
import { fomoSignalToMeshSignal } from './map';
import type { Signal } from '../../contracts/schemas';

export type FomoAssessment =
  | { ok: true; signals: Signal[] }
  | { ok: false; reason: string };

export async function assessFomoSignals(snapshotsDir: string, now?: string): Promise<FomoAssessment> {
  const at = now ?? new Date().toISOString();
  const result = await readFomoSnapshot(snapshotsDir);
  if (!result.ok) {
    return { ok: false, reason: `fomo UNAVAILABLE: ${result.error}` };
  }
  const signals = result.signals.map((signal, index) => fomoSignalToMeshSignal(signal, { observedAt: at, commit: result.commit, index }));
  return { ok: true, signals };
}
