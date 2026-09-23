/**
 * The Model Arena's registry (spec §10 + System-1 directive). Phase 0's audit found zero Laya or
 * Jev integration anywhere in this ecosystem; this session (2026-09-23) confirmed Laya is real,
 * public, and actually callable (see `laya-runtime.ts`, `scripts/laya_infer.py`, and the captured
 * fixtures in `__fixtures__/`) and researched Jev's real identity, but found no way to obtain
 * access to it. All three Laya checkpoints (`laya-typed`, `laya-english`, `laya-multilingual`)
 * have real, independently captured connections; everything else stays honestly `UNAVAILABLE`
 * with `provenance.source: 'UNAVAILABLE'` - no invented benchmark_results beyond what each
 * provider has itself published (tagged SELF_REPORTED, never presented as MESH_MEASURED).
 */
import type { ModelProfile } from '../../contracts/schemas';

const UNAVAILABLE_NOTE = (why: string) =>
  `UNAVAILABLE: ${why}. No live or simulated result exists for this model anywhere in MESH - see docs/MODEL_ARENA.md.`;

function unavailableEntry(args: {
  id: string;
  provider: string;
  checkpoint: string;
  license: string | null;
  runtime: string | null;
  parameter_count: number | null;
  supported_languages: string[];
  why: string;
  extraLimitations?: string[];
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
      note: UNAVAILABLE_NOTE(args.why),
    },
    status: 'UNAVAILABLE',
    model_id: args.id,
    provider: args.provider,
    checkpoint: args.checkpoint,
    license: args.license,
    runtime: args.runtime,
    parameter_count: args.parameter_count,
    context_limit: null,
    supported_languages: args.supported_languages,
    question_types: [],
    calibration_method: null,
    benchmark_results: [],
    known_limitations: [
      "parameter_count, where set, is a value the provider has published, not a MESH-verified measurement.",
      UNAVAILABLE_NOTE(args.why),
      ...(args.extraLimitations ?? []),
    ],
  };
}

/**
 * The three real, connected Laya entries (System-1 directive Step 2 + Arena activation). Status
 * is `SHADOW`, not `LIVE`: inference is real (see the fixtures below), but MESH-wide routing
 * stays in shadow mode - a Laya result is recorded, never yet authoritative - until the
 * directive's stop-conditions are met (real Jev path or confirmed UNAVAILABLE, arena built,
 * calibration addressed, failure handling tested). See `docs/MODEL_ARENA.md` for the full status.
 */
function liveLayaEntry(args: {
  id: string;
  checkpoint: string;
  parameter_count: number;
  context_limit: number;
  supported_languages: string[];
  accuracy: number;
  brier_score: number | null;
  ece: number | null;
  fixtureName: string;
  extraLimitations: string[];
}): ModelProfile {
  return {
    id: args.id,
    schema_version: '1.0',
    created_at: '2026-09-23T00:00:00.000Z',
    source: 'model-registry-adapter',
    provenance: {
      source: 'LIVE',
      system: 'convaiinnovations',
      retrieved_at: '2026-09-23T00:00:00.000Z',
      upstream_ref: `https://huggingface.co/${args.checkpoint}`,
      note: `LIVE: a real laya.load('${args.checkpoint}').predict() call was made via `
        + `scripts/laya_infer.py on 2026-09-23 - see __fixtures__/PROVENANCE.md for the exact `
        + `captured input/output (${args.fixtureName}). Status is SHADOW, not LIVE-authoritative: `
        + `MESH routing does not act on this result yet.`,
    },
    status: 'SHADOW',
    model_id: args.id,
    provider: 'convaiinnovations',
    checkpoint: args.checkpoint,
    license: 'apache-2.0',
    runtime: 'python-subprocess (laya PyPI 0.3.7, torch+transformers, invoked via `uv run --with laya`)',
    parameter_count: args.parameter_count,
    context_limit: args.context_limit,
    supported_languages: args.supported_languages,
    question_types: ['choice', 'score', 'noul'],
    calibration_method: "RLCD (REINFORCE + group-mean baseline, soft cross-entropy vs teacher) with "
      + "per-primitive temperature scaling; the checkpoint's own temperature_by_options overrides the "
      + "fitted per-type temperatures and includes a value outside its valid range [0.5, 5.0] - observed "
      + "directly this session as a RuntimeWarning on load, clipped to 0.5 by the runtime.",
    benchmark_results: [
      { metric: 'accuracy', value: args.accuracy, dataset: 'typed-decisions test split (400 cases / 2000 decisions)', dataset_version: 'model card, retrieved 2026-09-23', kind: 'SELF_REPORTED' },
      ...(args.brier_score !== null ? [{ metric: 'brier_score', value: args.brier_score, dataset: 'typed-decisions test split (400 cases / 2000 decisions)', dataset_version: 'model card, retrieved 2026-09-23', kind: 'SELF_REPORTED' as const }] : []),
      ...(args.ece !== null ? [{ metric: 'ece', value: args.ece, dataset: 'typed-decisions test split (400 cases / 2000 decisions)', dataset_version: 'model card, retrieved 2026-09-23', kind: 'SELF_REPORTED' as const }] : []),
    ],
    known_limitations: [
      "benchmark_results above are convaiinnovations' own published figures (SELF_REPORTED), not "
        + "MESH_MEASURED. Only MESH_MEASURED results may influence routing (System-1 directive §17); none exist yet.",
      "calibration = INSUFFICIENT_DATA (System-1 directive §14): MESH has no held-out domain data to "
        + "independently calibrate against yet. Do not treat `confidence` as a calibrated probability.",
      "Runtime cold-loads the checkpoint on every call (no persistent server yet) - a real, measured "
        + "limitation of this slice, documented in laya-runtime.ts.",
      ...args.extraLimitations,
    ],
  };
}

const LAYA_TYPED = liveLayaEntry({
  id: 'laya-typed',
  checkpoint: 'convaiinnovations/laya-typed-decisions',
  parameter_count: 421_000_000,
  context_limit: 1024,
  supported_languages: ['en'],
  accuracy: 0.766,
  brier_score: 0.062,
  ece: 0.213,
  fixtureName: 'laya-typed-fabrication-call.json',
  extraLimitations: [
    "English-only specialist: fine-tuned on four synthetic workflows (invoice processing, security "
      + "incidents, customer service, agent-trace observability). Expect base-checkpoint-or-worse "
      + "accuracy on carrier-fraud cases outside those workflows until MESH benchmarks it directly.",
    "Still over-confident per its own model card (ECE 0.213) versus the third-party Jev figure it "
      + "benchmarks against (ECE 0.144, unverified by MESH).",
  ],
});

const LAYA_ENGLISH = liveLayaEntry({
  id: 'laya-english',
  checkpoint: 'convaiinnovations/laya',
  parameter_count: 421_000_000,
  context_limit: 1024,
  supported_languages: ['en'],
  accuracy: 0.362,
  brier_score: null,
  ece: null,
  fixtureName: 'laya-english-fabrication-call.json',
  extraLimitations: [
    "General-purpose base checkpoint, NOT fine-tuned for typed-decisions: convaiinnovations' own "
      + "published accuracy on the typed-decisions test split is 0.362, far below laya-typed's 0.766 - "
      + "this entry exists to make the Arena real with a genuinely independent second model, not "
      + "because it is a good typed-decision model.",
  ],
});

const LAYA_MULTILINGUAL = liveLayaEntry({
  id: 'laya-multilingual',
  checkpoint: 'convaiinnovations/laya-multilingual',
  parameter_count: 322_000_000,
  context_limit: 1024,
  supported_languages: [],
  accuracy: 0.342,
  brier_score: null,
  ece: null,
  fixtureName: 'laya-multilingual-fabrication-call.json',
  extraLimitations: [
    "General-purpose multilingual base checkpoint, NOT fine-tuned for typed-decisions: "
      + "convaiinnovations' own published accuracy on the typed-decisions test split is 0.342, far "
      + "below laya-typed's 0.766. supported_languages is left empty rather than guessed - "
      + "convaiinnovations' model card does not enumerate the specific languages covered.",
  ],
});

const JEV_KNOWN_LIMITATIONS = [
  'Jev is real: "Jev" by TypeSafe AI, a "System-1" typed-decision model that returns floats for '
    + "categories/yes-no/ratings/confidence rather than generated text - confirmed via internal Amazon "
    + "AI-briefings (2026-09-17 to 2026-09-22) and directly via Laya's own model card, which benchmarks "
    + 'itself against "TypeSafe Jev 1.13.0 (published)".',
  "Access is invite-only early access and, per the same internal briefings, several people are still "
    + "waiting on invites as of 2026-09-22; Jev is not available on AWS Bedrock. No API key is "
    + "obtainable in this environment. Reported pricing (~$0.042 per million tokens) is third-party, not independently verified.",
  "Per the System-1 directive's own explicit rule, an unconfirmed/inaccessible runtime is honestly "
    + "JEV_STATUS = UNAVAILABLE - this is the correct call, not a shortfall.",
];

export const MODEL_REGISTRY: ModelProfile[] = [
  LAYA_ENGLISH,
  LAYA_MULTILINGUAL,
  LAYA_TYPED,
  unavailableEntry({
    id: 'jev',
    provider: 'TypeSafe AI',
    checkpoint: "Jev 1.13.0 (version referenced third-party in Laya's own model card; TypeSafe AI "
      + "publishes no public checkpoint identifier this research found)",
    license: null,
    runtime: 'TypeSafe AI hosted API (invite-only; not available on AWS Bedrock)',
    parameter_count: null,
    supported_languages: [],
    why: 'invite-only early access, no API key obtainable in this environment',
    extraLimitations: JEV_KNOWN_LIMITATIONS,
  }),
  unavailableEntry({
    id: 'open-jev',
    provider: 'unspecified (per directive)',
    checkpoint: 'unspecified',
    license: null,
    runtime: null,
    parameter_count: null,
    supported_languages: [],
    why: "this session's research found real evidence for \"Jev\" (TypeSafe AI) but none for a distinct "
      + '"open-jev" product - may be a conflation with Jev itself, or an open-source variant not '
      + 'discoverable via public search; not confirmed either way',
  }),
];

export function getModelRegistry(): ModelProfile[] {
  return MODEL_REGISTRY;
}

export function findModelProfile(modelId: string): ModelProfile | undefined {
  return MODEL_REGISTRY.find((m) => m.model_id === modelId);
}
