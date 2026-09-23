/**
 * Composes `client.ts` (real file read) and `map.ts` (translation) into the one entry point a case
 * engine would actually call. Every exit path is a discriminated result; there is no code path that
 * returns a `Behavior` built from anything other than a real fraud-watch MO record, and every one it
 * does return is unconditionally `simulated: true` (spec §16).
 */
import { readMoRecords } from './client';
import { moRecordToBehavior } from './map';
import type { Behavior } from '../../contracts/schemas';

export type FraudWatchBehaviorAssessment =
  | { ok: true; behaviors: Behavior[]; skipped: Array<{ id: string; reason: string }> }
  | { ok: false; reason: string };

export async function assessFraudWatchBehaviors(
  worldStatePath: string,
  caseId: string,
  now?: string,
): Promise<FraudWatchBehaviorAssessment> {
  const at = now ?? new Date().toISOString();

  const result = await readMoRecords(worldStatePath);
  if (!result.ok) {
    return { ok: false, reason: `fraud-watch UNAVAILABLE: ${result.error}` };
  }

  const behaviors: Behavior[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  for (const record of result.mos) {
    const mapped = moRecordToBehavior(record, caseId, at, worldStatePath);
    if (mapped.ok) behaviors.push(mapped.behavior);
    else skipped.push({ id: record.id, reason: mapped.reason });
  }

  return { ok: true, behaviors, skipped };
}
