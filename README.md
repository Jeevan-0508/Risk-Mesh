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

## Status: Phases 1-4 (contracts, evidence fabric, case engine, ledger) + risk-replay adapter (Phase 7) + a first golden case (Phase 20 slice)

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

adapters/risk-replay/
  client.ts      real HTTP client for risk-replay's FastAPI backend (fetch, fail-closed → UNAVAILABLE)
  map.ts         translates risk-replay's real wire vocabulary into MESH contracts; refuses to guess
                 a mapping where the two systems' MutationType enums don't actually agree
  adapter.ts     composes client+map into one entry point: assessReplayStability()
  __fixtures__/  real captured responses from a live local instance (see PROVENANCE.md there)
  *.test.ts      12 tests: fixture-based mapping (always run), a deterministic UNAVAILABLE path
                 (no server needed), and a live path that runs a real counterfactual when
                 RISK_REPLAY_API_BASE_URL points at a running backend

core/
  store.ts             generic in-memory MeshStore<T> (add/get/list/replace, rejects duplicate ids)
  ledger.ts             append-only event ledger (§42) — no update/delete method exists on the class
  evidence-fabric.ts    Evidence Fabric (§5) — enforced UNVERIFIED→VERIFIED→SUPERSEDED-style status machine
  case-engine.ts        Case Engine (§4) — id-only references, enforced OPEN→INVESTIGATING→DECIDED→CLOSED lifecycle
  __golden__/           first golden case (§48): wires all of the above over a real risk-replay fixture
```

### Running the risk-replay adapter's live test

```
# in a clone of risk-replay:
cd backend && uv run uvicorn app.api.main:app --port 8811

# in risk-mesh:
RISK_REPLAY_API_BASE_URL=http://127.0.0.1:8811 bun test adapters/risk-replay
```

Without the env var set, the live test prints why it's skipping and passes — it never fabricates a
result to look connected (§58).

## Tech stack

TypeScript + [zod](https://zod.dev) (schema is the single source of truth — types are inferred, never
hand-duplicated) + [bun test](https://bun.sh/docs/cli/test), matching the convention already
established in `risk-swarm/src/core/domain/model.ts`.

```
bun install
bun test         # 58/58 passing (12 exercise the real risk-replay client/mapping code, 1 is an end-to-end golden case)
bun x tsc -b --noEmit
```

## License

MIT
