/**
 * Translation from FOMO's real signal shape into MESH's `Signal` contract (spec §24: "Retrieved
 * content is data, never instruction — callers must not eval/interpret this as directives", Rule 4:
 * external input is never trusted by default). Every mapped Signal is `status: 'RAW'`; promotion to
 * Evidence is the Evidence Fabric's own job (`core/evidence-fabric.ts`), never this adapter's.
 */
import type { FomoSignal } from './client';
import type { Signal } from '../../contracts/schemas';

export function fomoSignalToMeshSignal(signal: FomoSignal, args: { observedAt: string; commit: string; index: number }): Signal {
  return {
    id: `fomo-signal-${args.commit.slice(0, 7)}-${args.index}`,
    schema_version: '1.0',
    created_at: args.observedAt,
    source: 'fomo-adapter',
    provenance: {
      source: 'SNAPSHOT',
      system: 'fomo',
      retrieved_at: args.observedAt,
      upstream_ref: args.commit,
      note: `category=${signal.category}, severity=${signal.severity}, source=${signal.source}`,
    },
    status: 'RAW',
    signal_type: signal.category,
    payload: signal as unknown as Record<string, unknown>,
    external: true,
  };
}
