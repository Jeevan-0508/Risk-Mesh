<p align="center"><img src="assets/jk-brand-banner.png" alt="Jeevan Siddhabhaktula: Risk. Governance. AI." width="280"></p>

# RISK//MESH

**The connective fabric between independent risk systems — contracts, evidence, provenance and
arbitration, not another engine.**

RISK//MESH does not simulate fraud, run counterfactual replay, or classify governance evidence —
[fraud-watch](https://github.com/Jeevan-0508/fraud-watch),
[risk-replay](https://github.com/Jeevan-0508/risk-replay), and
[policy-audit](https://github.com/Jeevan-0508/policy-audit) already do those, well, with their own
test suites. MESH's job is the layer none of them have a reason to own: a shared contract every
system's records can be mapped into, an evidence/provenance model with an honest six-value trust
label, and (once real cases exist) a trust/arbitration layer that reasons *across* systems.

## Status: Phase 1 of 20 — contracts only

See [`docs/ECOSYSTEM_AUDIT.md`](docs/ECOSYSTEM_AUDIT.md) for what Phase 0 found by reading the actual
code of every repo in the ecosystem — including a major finding that risk-swarm already implements
evidence tiering, disagreement-as-signal, and provenance-hashed cross-repo sync, which reshaped this
plan to avoid duplicating that work. See [`docs/MESH_ARCHITECTURE.md`](docs/MESH_ARCHITECTURE.md),
[`docs/INTEGRATION_MATRIX.md`](docs/INTEGRATION_MATRIX.md),
[`docs/MODEL_ARENA.md`](docs/MODEL_ARENA.md), and
[`docs/LEARNING_MODEL.md`](docs/LEARNING_MODEL.md) for the rest.

**Nothing beyond `contracts/` is implemented yet.** No adapter is connected. Laya and Jev are
`NOT_CONNECTED` everywhere in this repo and in the ecosystem — no fabricated results exist for either.

## What's here

```
contracts/
  schemas.ts     17 zod schemas from spec §3 (Case, Evidence, Signal, Behavior, Decision,
                 ModelResult, Disagreement, Challenge, Replay, CandidateMo, Outcome, Lesson,
                 Knowledge, Review, Trust, Experiment, ModelProfile)
  validate.ts    validateMeshObject(kind, candidate) — one dispatch point, not 17 imports
  index.ts       barrel export
  *.test.ts      30 tests: required fields, status enums, the honesty rule on Provenance.source
```

## Tech stack

TypeScript + [zod](https://zod.dev) (schema is the single source of truth — types are inferred, never
hand-duplicated) + [bun test](https://bun.sh/docs/cli/test), matching the convention already
established in `risk-swarm/src/core/domain/model.ts`.

```
bun install
bun test         # 30/30 passing
bun x tsc -b --noEmit
```

## License

MIT
