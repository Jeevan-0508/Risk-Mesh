/**
 * Translation between fraud-watch's real MO classification vocabulary
 * (`js/simulation/moEngine.js`, `CLASSIFICATION`, 4 values) and MESH's `BehaviorKind` (spec §16,
 * 8 values). The two were named independently and only partly agree:
 *
 *   Exact match (same name, same fact, mapped 1:1):
 *     KNOWN_MO, MO_VARIANT, EMERGING_BEHAVIOR. fraud-watch's own definitions for these three are the
 *     same fact MESH's names describe: recurrence at or above a familiarity floor, a first sighting
 *     that shares vocabulary with a documented pattern, and a taxonomy-coverage gap.
 *
 *   Semantic, not literal:
 *     fraud-watch's POTENTIAL_NEW_MO maps to MESH's EDGE_CASE, not to MESH's CANDIDATE_NEW_MO.
 *     fraud-watch's own comments in moEngine.js are explicit that POTENTIAL_NEW_MO does NOT mean
 *     "this looks like a new MO": it is issued for two different reasons (thin vocabulary overlap at
 *     first sighting, OR too few prior sightings for the count to say anything either way), and
 *     neither reason is a novelty claim. Mapping it to CANDIDATE_NEW_MO (which does assert novelty)
 *     would overclaim what fraud-watch itself says its own label means. EDGE_CASE, "insufficient
 *     evidence to classify confidently", is the honest fit.
 *
 *   MESH-only, no fraud-watch classification produces them:
 *     COMPOSITE_MO: fraud-watch has no separate "composite" class. Every MO signature is already a
 *       concatenation of signal types, so a composite isn't a distinct case in its vocabulary.
 *     CANDIDATE_NEW_MO: fraud-watch never asserts novelty (see the POTENTIAL_NEW_MO note above). A
 *       real candidate-new-MO judgement is MESH's own §17 pipeline (taxonomy diff, reproducibility
 *       across replay), not something read off one fraud-watch MO record.
 *     BENIGN_VARIANT: fraud-watch's classification vocabulary makes no benign/malicious judgement.
 *     FALSE_POSITIVE: collision warning, not a mapping gap. fraud-watch does have the exact string
 *       "FALSE_POSITIVE", but as a value of `status` (`CLOSED_STATUSES`, an investigation outcome),
 *       never of `classification`. The two fields are never the same fact in fraud-watch's own code,
 *       and this map only ever reads `classification`, so the collision cannot leak in here.
 */
import type { FraudWatchMoRecord } from './client';
import type { Behavior, BehaviorKind } from '../../contracts/schemas';

const CLASSIFICATION_TO_BEHAVIOR_KIND: Partial<Record<string, BehaviorKind>> = {
  KNOWN_MO: 'KNOWN_MO',
  MO_VARIANT: 'MO_VARIANT',
  EMERGING_BEHAVIOR: 'EMERGING_BEHAVIOR',
  POTENTIAL_NEW_MO: 'EDGE_CASE',
};

export type BehaviorKindMapResult =
  | { ok: true; kind: BehaviorKind }
  | { ok: false; reason: string };

export function mapClassification(fraudWatchClassification: string): BehaviorKindMapResult {
  const mapped = CLASSIFICATION_TO_BEHAVIOR_KIND[fraudWatchClassification];
  if (mapped) return { ok: true, kind: mapped };
  return { ok: false, reason: `fraud-watch classification "${fraudWatchClassification}" has no declared MESH BehaviorKind mapping.` };
}

function describeEntities(entities: Record<string, string | null>): string {
  const known = Object.entries(entities).filter(([, v]) => v != null);
  if (known.length === 0) return 'no entities recorded';
  return known.map(([k, v]) => `${k}=${v}`).join(', ');
}

export type MoToBehaviorResult =
  | { ok: true; behavior: Behavior }
  | { ok: false; reason: string };

/**
 * `Behavior.status` is always `'SIMULATED'` here, never fraud-watch's own investigation status
 * (NEW/MONITORING/CONFIRMED/...). Those two are different facts about the same record: MESH's status
 * says "this came from a simulation, not the real world" (spec §16) and never changes for a
 * fraud-watch-sourced Behavior; fraud-watch's own status is its investigation lifecycle, preserved
 * for traceability in `provenance.note` rather than squeezed into a field it doesn't fit.
 */
export function moRecordToBehavior(
  record: FraudWatchMoRecord,
  caseId: string,
  observedAt: string,
  worldStatePath: string,
): MoToBehaviorResult {
  const kindResult = mapClassification(record.classification);
  if (!kindResult.ok) return { ok: false, reason: kindResult.reason };

  return {
    ok: true,
    behavior: {
      id: `fraud-watch-behavior-${record.id}`,
      schema_version: '1.0',
      created_at: observedAt,
      source: 'fraud-watch-adapter',
      provenance: {
        source: 'SIMULATED',
        system: 'fraud-watch',
        retrieved_at: observedAt,
        upstream_ref: worldStatePath,
        note: `fraud-watch classification=${record.classification}, status=${record.status}, confidenceBand=${record.confidenceBand}, noveltyScore=${record.noveltyScore}, recurrenceCount=${record.recurrenceCount}`,
      },
      status: 'SIMULATED',
      case_id: caseId,
      kind: kindResult.kind,
      description: `fraud-watch MO ${record.id}: signature ${record.signature} (${describeEntities(record.entities)})`,
      simulated: true,
    },
  };
}
