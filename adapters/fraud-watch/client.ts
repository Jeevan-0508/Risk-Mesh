/**
 * Reads fraud-watch's real on-disk simulation state (`data/world-state.json`) directly:
 * fraud-watch is a static/vanilla-JS app with no server, so there is nothing to fetch. The read
 * either succeeds or fails; there is no live/network tier here at all. Everything this file reads is
 * simulation output, never a claim about the real world (spec §16), so a successful read is
 * `status: 'SIMULATED'`, never `'LIVE'`.
 */
import { readFile } from 'node:fs/promises';

export interface FraudWatchMoRecord {
  id: string;
  confidence: number;
  confidenceBand: string;
  status: string;
  classification: string;
  noveltyScore: number;
  recurrenceCount: number;
  signature: string;
  entities: Record<string, string | null>;
  signals: string[];
  timeline: Array<{ t: number; type: string }>;
  evidence: Array<{
    signalId: string;
    signalType: string;
    contribution: number;
    reliability: number;
    at: number;
    facilityId: string | null;
    facilityName: string | null;
  }>;
}

export type WorldStateResult =
  | { ok: true; status: 'SIMULATED'; mos: FraudWatchMoRecord[] }
  | { ok: false; status: 'UNAVAILABLE'; error: string };

/**
 * fraud-watch's `moEngine.mos` is a JS `Map` serialized to JSON, which comes out as an array of
 * `[id, record]` pairs rather than a plain array of records (confirmed against a real capture in
 * `__fixtures__/world-state.mos.json`). Guarded explicitly here rather than assumed, so a future
 * change to fraud-watch's serialization shape fails loudly as UNAVAILABLE instead of silently
 * reading garbage.
 */
export async function readMoRecords(worldStatePath: string): Promise<WorldStateResult> {
  let raw: string;
  try {
    raw = await readFile(worldStatePath, 'utf-8');
  } catch (error) {
    return { ok: false, status: 'UNAVAILABLE', error: `cannot read ${worldStatePath}: ${error instanceof Error ? error.message : String(error)}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { ok: false, status: 'UNAVAILABLE', error: `${worldStatePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }

  const moEngine = (parsed as { moEngine?: { mos?: unknown } } | null)?.moEngine;
  const entries = moEngine?.mos;
  if (!Array.isArray(entries)) {
    return { ok: false, status: 'UNAVAILABLE', error: `${worldStatePath} has no moEngine.mos array: fraud-watch's world-state shape may have changed` };
  }

  const mos: FraudWatchMoRecord[] = [];
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string') {
      return { ok: false, status: 'UNAVAILABLE', error: `moEngine.mos entry is not a [id, record] pair: ${JSON.stringify(entry).slice(0, 100)}` };
    }
    mos.push(entry[1] as FraudWatchMoRecord);
  }

  return { ok: true, status: 'SIMULATED', mos };
}
