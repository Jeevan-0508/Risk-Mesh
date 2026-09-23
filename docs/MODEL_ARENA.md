# MODEL ARENA

## Status today: one real connection (laya-typed, SHADOW), Jev confirmed real but inaccessible

Phase 0 confirmed zero Laya or Jev integration anywhere in the ecosystem (see
`ECOSYSTEM_AUDIT.md`). On 2026-09-23 (System-1 directive), that changed for exactly one model:
`laya-typed` now makes a real, live call to the actual `laya` PyPI package against the real
`convaiinnovations/laya-typed-decisions` checkpoint (Apache-2.0, public on HuggingFace) - see
`adapters/model-registry/laya-runtime.ts`, `scripts/laya_infer.py`, and the captured fixture in
`adapters/model-registry/__fixtures__/`. Its status is `SHADOW`, not `LIVE`: the connection is
real, but MESH-wide routing does not act on its results yet (no arena, no routing policy, no
calibration data exist yet - see below).

Jev was researched this session and confirmed real: "Jev" by TypeSafe AI, a "System-1"
typed-decision model, referenced directly in Laya's own model card benchmark table ("TypeSafe Jev
1.13.0 (published)") and in internal Amazon AI-briefings (2026-09-17 to 2026-09-22). Access is
invite-only and not available on AWS Bedrock; no API key is obtainable in this environment. Per
the System-1 directive's own explicit rule, this is `JEV_STATUS = UNAVAILABLE` - a researched,
honest conclusion, not an unexamined default.

An "arena" that compares independent models still needs at least two real, independently callable
models. MESH has one. This document specifies the registry and arena contract so that when a
second model becomes connectable (another Laya checkpoint, or a Jev invite), the shape is already
agreed - it does not simulate results in the meantime.

## Model registry (contract-level, implemented in Phase 1; richer status enum added 2026-09-23)

`ModelProfile` (see `contracts/schemas.ts`) fields, per MESH spec §10:

`model_id, provider, checkpoint, license, runtime, parameter_count, context_limit,
supported_languages, question_types, calibration_method, benchmark_results, known_limitations,
provenance`.

`status` is `LIVE | SHADOW | UNAVAILABLE | DISABLED | ERROR | DEPRECATED` (System-1 directive's
richer enum, replacing the original `ACTIVE | DEPRECATED | NOT_CONNECTED`): `LIVE` = connected AND
cleared by policy to influence real decisions (none yet); `SHADOW` = connected, real inference
confirmed, feeding shadow-mode observation only; `UNAVAILABLE` = no working connection; `DISABLED`
= intentionally turned off; `ERROR` = a configured connection that failed; `DEPRECATED` = retired.

`benchmark_results` entries are each tagged `SELF_REPORTED | THIRD_PARTY | MESH_MEASURED` per §10/§49.
**Only `MESH_MEASURED` entries may ever be used for routing decisions** - this is a routing-layer rule
to enforce once a router exists, not yet code, since there is no MESH_MEASURED data. `laya-typed`'s
entry carries its own published model-card figures (accuracy/Brier/ECE), tagged `SELF_REPORTED`.

## Registry entries (`adapters/model-registry/registry.ts`)

| model_id | provider | checkpoint | status |
|---|---|---|---|
| `laya-english` | convaiinnovations | `convaiinnovations/laya` (ModernBERT-large, 421M) | UNAVAILABLE - not yet independently invoked |
| `laya-multilingual` | convaiinnovations | `convaiinnovations/laya-multilingual` (mmBERT-base, 322M) | UNAVAILABLE - not yet independently invoked |
| `laya-typed` | convaiinnovations | `convaiinnovations/laya-typed-decisions` (ModernBERT-large, 421M) | **SHADOW - real, live inference confirmed** |
| `jev` | TypeSafe AI | Jev 1.13.0 (version only, no public checkpoint id found) | UNAVAILABLE - invite-only, no key obtainable |
| `open-jev` | unspecified (per directive) | unspecified | UNAVAILABLE - no evidence found for a product distinct from Jev itself |

`laya-english` and `laya-multilingual` share the exact same proven runtime path as `laya-typed`
(same `laya` package, same `load()`/`predict()` call, different checkpoint string) but have not
themselves been independently invoked this session - deliberately left `UNAVAILABLE` rather than
assumed `SHADOW` by association. Promoting them is a small, well-scoped follow-up, not a redesign.

## What connecting the next model actually requires

1. **laya-english / laya-multilingual -> SHADOW**: call `callLayaSubprocess` with each checkpoint
   once, capture a fixture, flip the registry entry - the pattern `laya-typed` already proves out.
2. **A real System-1 Arena** (`evaluation/system1-arena/`, not built yet): Laya answers a case
   without seeing any other model's answer; when a second model exists (another Laya checkpoint,
   or a Jev invite), disagreement becomes a first-class `Disagreement` object, never averaged away.
3. **Jev**: either an invite arrives (build the real HTTP client behind `JEV_API_KEY`, matching
   `.env.example`), or Jev stays `UNAVAILABLE` indefinitely and the arena runs Laya-checkpoint-only
   (still a real arena: three checkpoints of the same family answering the same case is genuine
   cross-model comparison, not a null result).
4. **Calibration** (§8/§14): MESH has no held-out domain dataset yet. `laya-typed`'s
   `known_limitations` already states `calibration = INSUFFICIENT_DATA` rather than inventing a
   number - this has to be built from real MESH cases, which do not exist yet either.

## Arena mechanics (contract-level design, partially implemented)

For a given case, each connected model produces a `ModelResult` (decision, probabilities,
confidence, uncertainty, primitive, latency_ms, raw_output, model_id, checkpoint) - this shape is
now real for `laya-typed` (`adapters/model-registry/client.ts`), not just schema. The arena is
designed to compute agreement/disagreement across results and never majority-vote them away (§11)
- disagreement becomes a `Disagreement` object with its own contract (already implemented,
reused from the risk-swarm adapter's `councilToDisagreement` pattern). The arena runtime that
calls two *different* models on the same case and compares them does not exist yet - `laya-typed`
today only ever answers alone.
