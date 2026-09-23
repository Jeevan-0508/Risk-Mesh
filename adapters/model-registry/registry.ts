/**
 * The Model Arena's registry (spec §10 + System-1 directive). Phase 0's audit found zero Laya or
 * Jev integration anywhere in this ecosystem; this session (2026-09-23) confirmed Laya is real,
 * public, and actually callable (see `laya-runtime.ts`, `scripts/laya_infer.py`, and the captured
 * fixture in `__fixtures__/laya-typed/`) and researched Jev's real identity, but found no way to
 * obtain access to it. `laya-typed` is the only entry with a real connection; everything else
 * stays honestly `UNAVAILABLE` with `provenance.source: 'UNAVAILABLE'` - no invented
 * benchmark_results beyond what each provider has itself published (tagged SELF_REPORTED, never
 * presented as MESH_MEASURED).
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
 * The one real, connected entry (System-1 directive Step 2). Status is `SHADOW`, not `LIVE`:
 * inference is real (see the fixture below), but MESH-wide routing stays in shadow mode - Laya's
 * result is recorded, never yet authoritative - until the directive's stop-conditions are met
 * (real Jev path or confirmed UNAVAILABLE, arena built, calibration addressed, failure handling
 * tested). See `docs/MODEL_ARENA.md` for the full status.
 */
const LAYA_TYPED: ModelProfile = {
  id: 'laya-typed',
  schema_version: '1.0',
  created_at: '2026-09-23T00:00:00.000Z',
  source: 'model-registry-adapter',
  provenance: {
    source: 'LIVE',
    system: 'convaiinnovations',
    retrieved_at: '2026-09-23T00:00:00.000Z',
    upstream_ref: 'https://huggingface.co/convaiinnovations/laya-typed-decisions',
    note: "LIVE: a real laya.load('convaiinnovations/laya-typed-decisions').predict() call was made "
      + "via scripts/laya_infer.py on 2026-09-23 - see __fixtures__/laya-typed/PROVENANCE.md for the "
      + "exact captured input/output. Status is SHADOW, not LIVE-authoritative: MESH routing does not "
      + "act on this result yet.",
  },
  status: 'SHADOW',
  model_id: 'laya-typed',
  provider: 'convaiinnovations',
  checkpoint: 'convaiinnovations/laya-typed-decisions',
  license: 'apache-2.0',
  runtime: 'python-subprocess (laya PyPI 0.3.7, torch+transformers, invoked via `uv run --with laya`)',
  parameter_count: 421_000_000,
  context_limit: 1024,
  supported_languages: ['en'],
  question_types: ['choice', 'score', 'noul'],
  calibration_method: "RLCD (REINFORCE + group-mean baseline, soft cross-entropy vs teacher) with "
    + "per-primitive temperature scaling; the checkpoint's own temperature_by_options overrides the "
    + "fitted per-type temperatures and includes a value outside its valid range [0.5, 5.0] - observed "
    + "directly this session as a RuntimeWarning on load, clipped to 0.5 by the runtime.",
  benchmark_results: [
    { metric: 'accuracy', value: 0.766, dataset: 'typed-decisions test split (400 cases / 2000 decisions)', dataset_version: 'model card, retrieved 2026-09-23', kind: 'SELF_REPORTED' },
    { metric: 'brier_score', value: 0.062, dataset: 'typed-decisions test split (400 cases / 2000 decisions)', dataset_version: 'model card, retrieved 2026-09-23', kind: 'SELF_REPORTED' },
    { metric: 'ece', value: 0.213, dataset: 'typed-decisions test split (400 cases / 2000 decisions)', dataset_version: 'model card, retrieved 2026-09-23', kind: 'SELF_REPORTED' },
  ],
  known_limitations: [
    "English-only specialist: fine-tuned on four synthetic workflows (invoice processing, security "
      + "incidents, customer service, agent-trace observability). Expect base-checkpoint-or-worse "
      + "accuracy on carrier-fraud cases outside those workflows until MESH benchmarks it directly.",
    "Still over-confident per its own model card (ECE 0.213) versus the third-party Jev figure it "
      + "benchmarks against (ECE 0.144, unverified by MESH). Do not treat `confidence` as a calibrated "
      + "probability. calibration = INSUFFICIENT_DATA (System-1 directive §14): MESH has no held-out "
      + "domain data to independently calibrate against yet.",
    "Runtime cold-loads the checkpoint on every call (~15s observed for this checkpoint on CPU) - no "
      + "persistent server yet. A real, measured limitation of this slice, documented in laya-runtime.ts.",
    "benchmark_results above are convaiinnovations' own published figures (SELF_REPORTED), not "
      + "MESH_MEASURED. Only MESH_MEASURED results may influence routing (System-1 directive §17); none exist yet.",
  ],
};

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
  unavailableEntry({
    id: 'laya-english',
    provider: 'convaiinnovations',
    checkpoint: 'convaiinnovations/laya',
    license: 'apache-2.0',
    runtime: "python-subprocess (laya PyPI package) - same runtime proven working for the sibling "
      + "`laya-typed` checkpoint this session, not independently tested for this specific checkpoint yet",
    parameter_count: 421_000_000,
    supported_languages: ['en'],
    why: 'not yet independently invoked in this environment (laya-typed was, this checkpoint was not)',
  }),
  unavailableEntry({
    id: 'laya-multilingual',
    provider: 'convaiinnovations',
    checkpoint: 'convaiinnovations/laya-multilingual',
    license: 'apache-2.0',
    runtime: "python-subprocess (laya PyPI package) - same runtime proven working for the sibling "
      + "`laya-typed` checkpoint this session, not independently tested for this specific checkpoint yet",
    parameter_count: 322_000_000,
    supported_languages: [],
    why: 'not yet independently invoked in this environment (laya-typed was, this checkpoint was not)',
  }),
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
