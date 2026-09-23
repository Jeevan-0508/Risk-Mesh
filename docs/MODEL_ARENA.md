# MODEL ARENA

## Status today: 3 real connections (all Laya checkpoints, SHADOW), a real Arena, Jev confirmed real but inaccessible

Phase 0 confirmed zero Laya or Jev integration anywhere in the ecosystem (see
`ECOSYSTEM_AUDIT.md`). On 2026-09-23 (System-1 directive), that changed: all three registered Laya
checkpoints (`laya-typed`, `laya-english`, `laya-multilingual`) now make real, live calls to the
actual `laya` PyPI package against their real `convaiinnovations/*` checkpoints (Apache-2.0,
public on HuggingFace) - see `adapters/model-registry/laya-runtime.ts`, `scripts/laya_infer.py`,
and the three captured fixtures + `PROVENANCE.md` in `adapters/model-registry/__fixtures__/`.
Their status is `SHADOW`, not `LIVE`: the connections are real, but MESH-wide routing does not act
on their results yet (no routing policy, no calibration data exist yet - see below).

Jev was researched this session and confirmed real: "Jev" by TypeSafe AI, a "System-1"
typed-decision model, referenced directly in Laya's own model card benchmark table ("TypeSafe Jev
1.13.0 (published)") and in internal Amazon AI-briefings (2026-09-17 to 2026-09-22). Access is
invite-only and not available on AWS Bedrock; no API key is obtainable in this environment. Per
the System-1 directive's own explicit rule, this is `JEV_STATUS = UNAVAILABLE` - a researched,
honest conclusion, not an unexamined default.

An "arena" that compares independent models needs at least two real, independently callable
models. MESH now has three, all from the same family (Laya) - a real cross-model comparison, not a
null result: `evaluation/system1-arena/` calls any 2+ requested model_ids independently (no model
ever sees another's answer) and builds a real `Disagreement` (never averaged away) when they don't
match. It does not simulate a result for Jev or any other model in the meantime.

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
to enforce once a router exists, not yet code, since there is no MESH_MEASURED data. All three Laya
entries carry their own published model-card figures (accuracy/Brier/ECE where published), tagged
`SELF_REPORTED`.

## Registry entries (`adapters/model-registry/registry.ts`)

| model_id | provider | checkpoint | status | typed-decisions accuracy (self-reported) |
|---|---|---|---|---|
| `laya-english` | convaiinnovations | `convaiinnovations/laya` (421M) | **SHADOW - real, live inference confirmed** | 0.362 (not fine-tuned) |
| `laya-multilingual` | convaiinnovations | `convaiinnovations/laya-multilingual` (322M) | **SHADOW - real, live inference confirmed** | 0.342 (not fine-tuned) |
| `laya-typed` | convaiinnovations | `convaiinnovations/laya-typed-decisions` (421M) | **SHADOW - real, live inference confirmed** | 0.766 (fine-tuned specialist) |
| `jev` | TypeSafe AI | Jev 1.13.0 (version only, no public checkpoint id found) | UNAVAILABLE - invite-only, no key obtainable | n/a |
| `open-jev` | unspecified (per directive) | unspecified | UNAVAILABLE - no evidence found for a product distinct from Jev itself | n/a |

`laya-english` and `laya-multilingual` are general-purpose base checkpoints, not fine-tuned for
typed-decisions - their much lower accuracy versus `laya-typed` is stated directly in each entry's
`known_limitations`, not hidden. They exist to make the Arena a genuine 3-model comparison, not
because they are good typed-decision models on their own.

## System-1 Arena (`evaluation/system1-arena/`, live as of 2026-09-23)

- `compare.ts` - `compareModelResults(results, {caseId, observedAt})`: pure comparison over 2+
  `ModelResult`s. All decisions equal -> `{agreement: true, model_agreement_score: 0.9}` (`ASSUMED`
  placeholder, matching `core/trust-engine.ts`'s own convention - no MESH-measured outcome data
  exists yet to calibrate against). Any difference -> a real `Disagreement` object (spec §35),
  never a majority vote or an average.
- `run.ts` - `runSystem1Arena(modelIds, input, deps?)`: calls `assessModelCall` once per requested
  model_id, structurally independent (no model's result is ever passed into another's call).
  Requires >= 2 real (`ok:true`) results or fails closed with the actual per-model failure reason
  (e.g. `jev: UNAVAILABLE: invite-only...`) - never pads the comparison with a fabricated stand-in.
- Verified this session with all 3 real Laya checkpoints via injected fixture-backed runners
  (`run.test.ts`): a genuine 2-model disagreement, a genuine agreement path, a 3-model comparison,
  and the "only 1 of N requested models is actually connected" failure path with `jev`.

## What connecting the next model actually requires

1. **Jev**: either an invite arrives (build the real HTTP client behind `JEV_API_KEY`, matching
   `.env.example`), or Jev stays `UNAVAILABLE` indefinitely and the arena runs Laya-checkpoint-only
   (still a real arena, as above).
2. **Calibration** (§8/§14): MESH has no held-out domain dataset yet. Every Laya entry's
   `known_limitations` already states `calibration = INSUFFICIENT_DATA` rather than inventing a
   number - this has to be built from real MESH cases, which do not exist yet either.
3. **System-1 routing** (`core/arbitration-engine.ts`, next slice): Laya confident -> ACCEPT;
   uncertain -> escalate (Jev unavailable, so no CALL_JEV path yet); models agree -> ACCEPT_SYSTEM1;
   models disagree -> ESCALATE_TO_SWARM; high-risk cases -> REQUIRE_DEEP_REVIEW regardless of any
   model's output.

## Arena mechanics (contract-level design, now implemented for Laya-family models)

For a given case, each connected model produces a `ModelResult` (decision, probabilities,
confidence, uncertainty, primitive, latency_ms, raw_output, model_id, checkpoint) - this shape is
real for all 3 Laya checkpoints (`adapters/model-registry/client.ts`). The arena computes
agreement/disagreement across results and never majority-votes them away (§11) - disagreement
becomes a `Disagreement` object with its own contract (`evaluation/system1-arena/compare.ts`,
the same idea as the risk-swarm adapter's `councilToDisagreement`, kept as its own function since
it generalizes over any `ModelResult[]` rather than risk-swarm's own `CouncilResult` type).
