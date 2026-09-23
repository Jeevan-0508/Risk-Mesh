# MODEL ARENA

## Status today: no arena, because no second System-1 model is connected

Phase 0 confirmed zero Laya or Jev integration anywhere in the ecosystem (see
`ECOSYSTEM_AUDIT.md`). An "arena" that compares models needs at least two real, independently
callable models. Right now MESH has zero. This document specifies the registry and arena contract so
that when a model becomes connectable, the shape is already agreed — it does not simulate results in
the meantime.

## Model registry (contract-level, implemented in Phase 1)

`ModelProfile` (see `contracts/schemas.ts`) fields, per MESH spec §10:

`model_id, provider, checkpoint, license, runtime, parameter_count, context_limit,
supported_languages, question_types, calibration_method, benchmark_results, known_limitations,
provenance`.

`benchmark_results` entries are each tagged `SELF_REPORTED | THIRD_PARTY | MESH_MEASURED` per §10/§49.
**Only `MESH_MEASURED` entries may ever be used for routing decisions** — this is a routing-layer rule
to enforce once a router exists (Phase 11+), not yet code, since there is no measured data.

## Registry entries — IMPLEMENTED (`adapters/model-registry/registry.ts`), still architecture-only

| model_id | provider | checkpoint | status |
|---|---|---|---|
| `laya-english` | convaiinnovations | `convaiinnovations/laya` (ModernBERT-large, 421M) | NOT_CONNECTED |
| `laya-multilingual` | convaiinnovations | `convaiinnovations/laya-multilingual` (mmBERT-base, 322M) | NOT_CONNECTED |
| `laya-typed` | convaiinnovations | `convaiinnovations/laya-typed-decisions` (ModernBERT-large, 421M) | NOT_CONNECTED |
| `jev` | (per directive) | unspecified | NOT_CONNECTED — no API access confirmed |
| `open-jev` family | (per directive) | unspecified | NOT_CONNECTED |

No `parameter_count`/`context_limit`/`benchmark_results` values are filled in beyond what's stated in
the directive itself, and those are recorded as `SELF_REPORTED` (from the directive's text, which
functions here as a third-party claim, not a MESH measurement) — not verified against the actual model
cards yet.

## What "connecting" a model actually requires (for whoever does this next)

1. Real HF Hub access + enough local/remote compute to run a 322-421M encoder model, or a hosted
   inference endpoint — neither exists in this sandbox.
2. A Jev API key/endpoint, or an explicit decision that Jev stays `UNAVAILABLE` indefinitely and the
   arena runs Laya-only (still useful: Laya's 3 checkpoints alone give a same-case, cross-checkpoint
   comparison, which is a real arena even without Jev).
3. Calibration/train/validation/test dataset separation (§8) — MESH has no dataset yet, calibrated or
   otherwise. This has to be built from real MESH cases, which do not exist yet either.

## Arena mechanics (contract-level design, not implemented)

For a given case, each connected model produces a `ModelResult` (decision, probabilities, confidence,
latency, model_id, checkpoint). The arena computes agreement/disagreement across results and never
majority-votes them away (§11) — disagreement becomes a `Disagreement` object with its own contract.
This is designed in the schema layer already; the runtime that calls real models does not exist.
