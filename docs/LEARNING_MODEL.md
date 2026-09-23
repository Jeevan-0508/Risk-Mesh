# LEARNING MODEL

## Why this is designed but not built yet

MESH spec §27 is explicit that learning runs `CASE → DECISION → OUTCOME → ERROR ANALYSIS → LESSON
CANDIDATE → VALIDATION → BENCHMARK → APPROVED LESSON → KNOWLEDGE VERSION`. Every stage after
"CASE" needs a real case with a real outcome to operate on. As of Phase 0, MESH has processed zero
cases. Building the validation/benchmark/decay machinery now would mean testing it against fabricated
outcomes — exactly the kind of self-deception §7 and §58 warn against elsewhere in the spec. This
document fixes the contract and lifecycle now (so later phases build to a stable target) and defers
the runtime.

## Lifecycle (contract-level, `contracts/schemas.ts`)

```
CASE → DECISION → OUTCOME → LESSON (status: CANDIDATE)
                              ↓ validation
                          VERIFIED → VALIDATED → ADOPTED
                              ↓ (any point)          ↓ time / contradiction
                          REJECTED                SUPERSEDED / DECAYED
```

States mirror §29 exactly: `CANDIDATE | VERIFIED | VALIDATED | ADOPTED | SUPERSEDED | REJECTED |
DECAYED`. A `Lesson` object cannot skip from `CANDIDATE` to `ADOPTED` — the schema records
`validation_status` as one field, but the *transition rules* (which state may move to which) are a
Phase-12 runtime concern, not yet implemented; recording that gap explicitly rather than letting the
schema imply more control than exists.

## What "validation" will require, concretely

A lesson candidate is only as good as the outcome it is drawn from. Before MESH marks anything
`VALIDATED`:

1. The source case's outcome must itself be real (not simulated) — Fraud Watch's hidden ground truth
   rule (§16) applies transitively: a lesson learned from a simulated case is `PROVISIONAL` forever,
   never promoted to `ADOPTED` knowledge that changes live routing.
2. A contradiction check against existing adopted knowledge (§28: memory operations include
   `CONTRADICT`).
3. A benchmark run against golden/adversarial/regression case sets (§31) — none of which exist yet;
   Phase 20 ("full end-to-end golden investigation") is the first point at which a golden case set
   exists to benchmark against.

## Explicit non-goal for this phase

No fine-tuning, no adapter training, no automatic model change (§54). The learning ledger's only job
right now is to make the *lifecycle states* real and queryable once cases exist — not to close any
loop yet. Closing the loop (§37, §53) needs: real Fraud Watch candidate-MO objects (which do not exist
in fraud-watch's code today, per the ecosystem audit), a working risk-replay adapter, and at least one
real disagreement recorded by the arena (which needs a connected second model, which is blocked).

## Sequencing dependency graph (why phases are ordered this way)

```
Phase 1 (contracts)  →  Phase 3 (case engine)  →  Phase 5-9 (adapters produce real cases)
                                                         ↓
                                          Phase 12 (learning ledger has real material)
                                                         ↓
                                    Phase 17 (self-improvement proposals become meaningful)
```

Skipping ahead to Phase 12-18 before Phase 5-9 produce real cases would mean building a learning
system with nothing true to learn from — noted here so nobody mistakes an early learning-ledger
scaffold for a working self-improvement loop.
