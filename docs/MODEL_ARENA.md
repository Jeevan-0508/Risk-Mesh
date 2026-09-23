# MODEL ARENA

## Status today: 3 real connections (all Laya checkpoints, SHADOW), a real Arena, Jev confirmed real but inaccessible

Phase 0 confirmed zero Laya or Jev integration anywhere in the ecosystem (see
`ECOSYSTEM_AUDIT.md`). On 2026-09-23 (System-1 directive), that changed: all three registered Laya
checkpoints (`laya-typed`, `laya-english`, `laya-multilingual`) now make real, live calls to the
actual `laya` PyPI package against their real `convaiinnovations/*` checkpoints (Apache-2.0,
public on HuggingFace) - see `adapters/model-registry/laya-runtime.ts`, `scripts/laya_infer.py`,
and the three captured fixtures + `PROVENANCE.md` in `adapters/model-registry/__fixtures__/`.
Their status is `SHADOW`, not `LIVE`: the connections are real, and a shadow-mode routing
recommendation now exists (`decideSystem1Action()`, see below), but nothing in this repo wires it
into a case's real, authoritative `Decision` yet - it is a recommendation for the Observatory to
compare against MESH's actual decisions, not a live routing policy.

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

## System-1 shadow routing (`core/arbitration-engine.ts`'s `decideSystem1Action()`, live as of 2026-09-23)

A sibling to `decideArbitrationAction()`, not a replacement: Laya's registry status is `SHADOW`,
so this function's output is a shadow-mode recommendation for the Observatory to compare against
MESH's real decisions - nothing in this repo wires it into a case's authoritative `Decision` yet.
Deliberately takes only `contracts/schemas` types (never `evaluation/system1-arena`'s own types),
matching `core/`'s existing import direction (it imports nothing from `adapters/` or `evaluation/`
anywhere in this repo).

Routing table, first matching branch wins, most disqualifying first:

| condition | action |
|---|---|
| `caseRisk === 'HIGH'` | `REQUIRE_DEEP_REVIEW` - checked first, overrides any model signal |
| no results at all | `HUMAN_REVIEW` |
| 2+ models agree (a real Arena comparison) | `ACCEPT_SYSTEM1` |
| 2+ models disagree, swarm reachable | `ESCALATE_TO_SWARM` |
| 2+ models disagree, swarm not connected | `HUMAN_REVIEW` |
| 1 model, confident (`uncertainty <= 0.7`, `ASSUMED` ceiling) | `ACCEPT` |
| 1 model, uncertain, Jev reachable | `CALL_JEV` |
| 1 model, uncertain, Jev unavailable, swarm reachable | `ESCALATE_TO_SWARM` |
| 1 model, uncertain, nothing reachable | `HUMAN_REVIEW` |

`caseRisk`, `jevAvailable` are honest parameters, not hard-coded: this repo has no risk-scoring
field anywhere in `contracts/schemas.ts` (checked directly), and Jev is `UNAVAILABLE` everywhere
today - both stay at their default (`STANDARD`/`false`) in every real case in this repo, exactly
like `ArbitrationContext.swarmAvailable`'s own established precedent. 21 tests in
`core/arbitration-engine.test.ts` exercise every branch above directly.

## Fraud Watch integration (`evaluation/system1-arena/fraud-watch-cases.ts`, live as of 2026-09-23)

The first real call site for `decideSystem1Action()`: a full pipeline from a real fraud-watch
`Behavior` (MESH's own upstream simulation, spec §16) to a shadow routing recommendation.

- `CARRIER_BEHAVIOR_QUESTION` - a real captured `LayaQuestion` (`carrier_behavior_call`, type
  `choice`, criteria `normal`/`investigate`/`inconclusive`), matching exactly what was sent to the
  checkpoint below.
- `behaviorToLayaState(behavior)` - a pure mapper from `Behavior` to a Laya `state` string. Passes
  only `behavior.description` (MESH-tested, ground-truth-free) plus one static framing sentence.
  Deliberately excludes fraud-watch's own `confidence`, `confidenceBand`, `noveltyScore`, and
  `investigation` fields: those are fraud-watch's own pre-computed judgment about the same signals,
  and handing them to Laya would be asking it to grade someone else's conclusion instead of forming
  an independent read from the raw signal. `Behavior.simulated: true` is a provenance flag, not a
  fraud/no-fraud verdict - there is no such verdict field anywhere in `FraudWatchMoRecord`. Tested
  directly with a "never leaks" assertion in `fraud-watch-cases.test.ts`.
- `arenaComparisonToSystem1Input(results, comparison)` - translates `evaluation/`'s `ArenaComparison`
  into `core/`'s plain `System1Input` shape. This is the seam the shadow-routing section above
  described but had no caller for; it exists here rather than in `core/` to keep `core/`'s import
  direction unchanged (still nothing imported from `adapters/` or `evaluation/`).
- `evaluateBehaviorViaSystem1(behavior, modelIds, context, deps?)` - the end-to-end pipeline:
  `Behavior` -> `behaviorToLayaState` -> `runSystem1Arena` -> `compareModelResults` ->
  `arenaComparisonToSystem1Input` -> `decideSystem1Action`.

Verified this session against real fraud-watch MO-0001 data (signature
`EQUIPMENT_CARRIER_MISMATCH+FALSE_MILESTONE_STAMP+HANDOVER_GAP+MANIFEST_CHANGED`), run through the
real `laya-typed-decisions` checkpoint (`laya-typed-fraud-watch-mo0001-call.json`): a genuinely
leaning result (`choice: investigate`, `confidence: 0.1494`, probabilities
`{normal: 0.1513, investigate: 0.6042, inconclusive: 0.2445}`), not the near-uniform split seen in
the first fixture. 8 tests in `fraud-watch-cases.test.ts` cover the state-mapping exclusion, the
question fixture match, the input-translation shape, agreement -> `ACCEPT_SYSTEM1`, disagreement ->
`ESCALATE_TO_SWARM`, and the fails-closed path with fewer than 2 real models.

## Calibration pipeline (`evaluation/calibration/pipeline.ts`, live as of 2026-09-23)

The pure math a real calibration check needs (Brier score + a 10-bucket reliability diagram over
`{confidence, correct}` samples) is built and tested - against a clearly-synthetic verification
dataset, not MESH data - but has **no real call site**: this repo has zero real `Outcome` records
anywhere (`contracts/schemas.ts` section 11 already has the field a calibration check would need,
`matches_prediction`, but a direct search for it and `actual_result` outside the schema file and
tests finds nothing real constructing one - not even the two golden cases carry one). Building a
bridge from `ModelResult` to `Outcome` today would mean inventing an assumption spec §8/§14 does
not state (whether one case's `Outcome.matches_prediction` describes each individual System-1
model's own correctness, or only the case's final Decision) - the same reason
`docs/MESH_ARCHITECTURE.md` already declines to write the learning ledger's validation machinery.
`runSystem1Calibration()` called with no arguments - this repo's real state today - returns
`INSUFFICIENT_DATA, sampleSize: 0`, not a fabricated number. 6 tests in `pipeline.test.ts`.

## Outcome evaluation (`core/outcome-engine.ts`, live as of 2026-09-23)

`OutcomeEngine.record()` is the one real place in this repo where an `Outcome` object can actually
be stored and linked to its case, and it deliberately does not close the `ModelResult → Outcome`
gap described above: `matches_prediction` stays whatever the caller passes in, never a value this
engine derives from a `ModelResult` or a `Decision`. That is the same "no un-spec'd assumption"
rule the calibration pipeline follows, applied to the write path instead of the read path - a
correct `OutcomeEngine` does not quietly answer the question `runSystem1Calibration()`'s docs
above explicitly decline to answer. 5 tests in `outcome-engine.test.ts`.

## What connecting the next model actually requires

1. **Jev**: either an invite arrives (build the real HTTP client behind `JEV_API_KEY`, matching
   `.env.example`), or Jev stays `UNAVAILABLE` indefinitely and the arena runs Laya-checkpoint-only
   (still a real arena, as above).
2. **Calibration** (§8/§14, see above): the math exists now, and `OutcomeEngine` can now record a
   real `Outcome` once one exists, but no case in this repo has been through a real human-confirmed
   result yet - Fraud Watch integration and System-1 Observability (above) supply a real case
   source and real model calls, but not real outcomes, so calibration stays `INSUFFICIENT_DATA`
   until real cases accumulate real, recorded results.

## Arena mechanics (contract-level design, now implemented for Laya-family models)

For a given case, each connected model produces a `ModelResult` (decision, probabilities,
confidence, uncertainty, primitive, latency_ms, raw_output, model_id, checkpoint) - this shape is
real for all 3 Laya checkpoints (`adapters/model-registry/client.ts`). The arena computes
agreement/disagreement across results and never majority-votes them away (§11) - disagreement
becomes a `Disagreement` object with its own contract (`evaluation/system1-arena/compare.ts`,
the same idea as the risk-swarm adapter's `councilToDisagreement`, kept as its own function since
it generalizes over any `ModelResult[]` rather than risk-swarm's own `CouncilResult` type).
