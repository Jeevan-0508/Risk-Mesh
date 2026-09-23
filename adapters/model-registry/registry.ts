/**
 * The Model Arena's registry (spec §10), architecture-only per `docs/MODEL_ARENA.md`: Phase 0's
 * audit found zero Laya or Jev integration anywhere in this ecosystem, and this sandbox has neither
 * HuggingFace credentials/runtime nor a Jev API key. Every entry here is therefore `NOT_CONNECTED`
 * with `provenance.source: 'UNAVAILABLE'` — no live numbers, no invented benchmark_results.
 * parameter_count values are the directive's own stated figures, carried here as an unverified claim
 * (see `known_limitations`), never presented as a MESH measurement.
 */
import type { ModelProfile } from '../../contracts/schemas';

const NOT_CONNECTED_NOTE = (why: string) =>
  `NOT_CONNECTED: ${why}. No live or simulated result exists for this model anywhere in MESH — see docs/MODEL_ARENA.md.`;

function registryEntry(args: {
  id: string;
  provider: string;
  checkpoint: string;
  runtime: string | null;
  parameter_count: number | null;
  supported_languages: string[];
  why: string;
}): ModelProfile {
  return {
    id: args.id,
    schema_version: '1.0',
    created_at: '2026-09-23T00:00:00.000Z',
    source: 'model-registry-adapter',
    provenance: {
      source: 'UNAVAILABLE',
      system: args.provider,
      retrieved_at: '2026-09-23T00:00:00.000Z',
      upstream_ref: null,
      note: NOT_CONNECTED_NOTE(args.why),
    },
    status: 'NOT_CONNECTED',
    model_id: args.id,
    provider: args.provider,
    checkpoint: args.checkpoint,
    license: null,
    runtime: args.runtime,
    parameter_count: args.parameter_count,
    context_limit: null,
    supported_languages: args.supported_languages,
    question_types: [],
    calibration_method: null,
    benchmark_results: [],
    known_limitations: [
      'parameter_count, where set, is the directive\'s own stated figure, not a MESH-verified value.',
      NOT_CONNECTED_NOTE(args.why),
    ],
  };
}

export const MODEL_REGISTRY: ModelProfile[] = [
  registryEntry({
    id: 'laya-english',
    provider: 'convaiinnovations',
    checkpoint: 'convaiinnovations/laya',
    runtime: 'HuggingFace Transformers (ModernBERT-large)',
    parameter_count: 421_000_000,
    supported_languages: ['en'],
    why: 'no HuggingFace credentials or local inference runtime configured in this environment',
  }),
  registryEntry({
    id: 'laya-multilingual',
    provider: 'convaiinnovations',
    checkpoint: 'convaiinnovations/laya-multilingual',
    runtime: 'HuggingFace Transformers (mmBERT-base)',
    parameter_count: 322_000_000,
    supported_languages: [],
    why: 'no HuggingFace credentials or local inference runtime configured in this environment',
  }),
  registryEntry({
    id: 'laya-typed',
    provider: 'convaiinnovations',
    checkpoint: 'convaiinnovations/laya-typed-decisions',
    runtime: 'HuggingFace Transformers (ModernBERT-large)',
    parameter_count: 421_000_000,
    supported_languages: ['en'],
    why: 'no HuggingFace credentials or local inference runtime configured in this environment',
  }),
  registryEntry({
    id: 'jev',
    provider: 'unspecified (per directive)',
    checkpoint: 'unspecified',
    runtime: null,
    parameter_count: null,
    supported_languages: [],
    why: 'no Jev API key or endpoint confirmed anywhere in this environment',
  }),
  registryEntry({
    id: 'open-jev',
    provider: 'unspecified (per directive)',
    checkpoint: 'unspecified',
    runtime: null,
    parameter_count: null,
    supported_languages: [],
    why: 'no open-jev API key or endpoint confirmed anywhere in this environment',
  }),
];

export function getModelRegistry(): ModelProfile[] {
  return MODEL_REGISTRY;
}

export function findModelProfile(modelId: string): ModelProfile | undefined {
  return MODEL_REGISTRY.find((m) => m.model_id === modelId);
}
