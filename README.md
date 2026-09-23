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

## Status: Phases 1-4 (contracts, evidence fabric, case engine, ledger) + risk-replay adapter (Phase 7) + fraud-watch adapter (Phase 5) + risk-swarm adapter (Phase 6) + trust/arbitration engines (Phase 11) + a first golden case (Phase 20 slice) + FOMO and freight-risk-atlas snapshot adapters + model registry (Phases 8-10, honestly NOT_CONNECTED) + learning ledger lifecycle engine (Phase 12)

See [`docs/ECOSYSTEM_AUDIT.md`](docs/ECOSYSTEM_AUDIT.md) for what Phase 0 found by reading the actual
code of every repo in the ecosystem — including a major finding that risk-swarm already implements
evidence tiering, disagreement-as-signal, and provenance-hashed cross-repo sync, which reshaped this
plan to avoid duplicating that work. See [`docs/MESH_ARCHITECTURE.md`](docs/MESH_ARCHITECTURE.md),
[`docs/INTEGRATION_MATRIX.md`](docs/INTEGRATION_MATRIX.md),
[`docs/MODEL_ARENA.md`](docs/MODEL_ARENA.md), and
[`docs/LEARNING_MODEL.md`](docs/LEARNING_MODEL.md) for the rest.

Five adapters are implemented and tested against real captured or hash-verified data: risk-replay (live-verified
against its real FastAPI backend), fraud-watch (real on-disk simulation state), risk-swarm (real
captured council runs), and FOMO/freight-risk-atlas (both read via risk-swarm's own hash-verified
snapshot sync, so MESH never re-syncs from those two repos directly). Laya and Jev are
registered in `adapters/model-registry/` (5 real checkpoints, architecture-only) but `NOT_CONNECTED`
everywhere in this repo and in the ecosystem — no fabricated results exist for either.

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

adapters/fraud-watch/
  client.ts      reads fraud-watch's real data/world-state.json directly (static app, no server)
  map.ts         maps fraud-watch's 4-value classification vocabulary onto MESH's 8-value
                 BehaviorKind; only maps what genuinely means the same thing, documents the rest
  adapter.ts     composes client+map: assessFraudWatchBehaviors(), every output simulated:true
  __fixtures__/  a real captured data/world-state.json (see PROVENANCE.md there)
  *.test.ts      13 tests, all fixture-based (no server exists to be live against)

adapters/risk-swarm/
  types.ts       type-level mirror of risk-swarm's real CouncilResult/OlympianPosition/etc — no
                 client.ts: risk-swarm has no server and pushes no persisted council export anywhere
  map.ts         pure translation, caller supplies the CouncilResult + an honest provenanceSource;
                 councilToDisagreement() fails closed rather than counting a degraded fallback as
                 independent (mirrors risk-swarm's own DisagreementAssessment doc comment)
  adapter.ts     composes map.ts: assessCouncilResult()
  __fixtures__/  real captures of risk-swarm's own runCouncil(), same fetch-mock technique as its
                 own test suite (majority-disagreement + degraded-agent scenarios)
  *.test.ts      10 tests, all fixture-based

adapters/_shared/
  snapshot-provenance.ts  readVerifiedSnapshotFile(): shared read+verify step reused by fomo/ and
                 freight-risk-atlas/ - reads risk-swarm's own provenance.json, recomputes sha256 with
                 the same call its sync-snapshots.mjs uses, fails closed on any mismatch
  __fixtures__/  real data, trimmed: first 5 of FOMO's real 874 synced signals, first 2 of
                 freight-risk-atlas's real 12 taxonomy patterns; a dedicated mismatch-dir fixture
                 exercises the hash-mismatch failure path (see PROVENANCE.md there)
  *.test.ts      5 tests

adapters/fomo/
  client.ts      readFomoSnapshot(): reads FOMO's real synced signals via the shared helper above,
                 not by re-syncing from FOMO's own repo directly
  map.ts         fomoSignalToMeshSignal(): every mapped Signal is unconditionally status:'RAW' (§24,
                 Rule 4) - promotion to Evidence stays the Evidence Fabric's job, never this adapter's
  adapter.ts     composes client+map: assessFomoSignals()
  *.test.ts      8 tests, all fixture-based against the real trimmed signals.json fixture

adapters/freight-risk-atlas/
  client.ts      readTaxonomySnapshot(): reads the real synced taxonomy.json via the shared helper
  map.ts         taxonomyVersionRecord() feeds CandidateMo.taxonomy_version/taxonomy_hash (§17) from
                 risk-swarm's already-verified sha256, never re-hashed independently;
                 findPatternById()/findPatternsByCategory() are plain lookups, no fuzzy matching
  adapter.ts     composes client+map: assessTaxonomy()
  *.test.ts      8 tests, all fixture-based against the real trimmed 2-pattern fixture

adapters/model-registry/
  registry.ts    the 5 real ModelProfile entries from docs/MODEL_ARENA.md (3 Laya checkpoints + jev
                 + open-jev), every one status:'NOT_CONNECTED', provenance.source:'UNAVAILABLE'
  client.ts      callModel() has no success path at all — always NOT_CONNECTED or UNAVAILABLE,
                 never a fabricated ModelResult (spec §9/§10)
  adapter.ts     composes registry+client: assessModelCall(), registryStatusSummary()
  *.test.ts      11 tests, all fixture-free (nothing to fetch — asserts the honest-failure shape)

core/
  store.ts             generic in-memory MeshStore<T> (add/get/list/replace, rejects duplicate ids)
  ledger.ts             append-only event ledger (§42) — no update/delete method exists on the class
  evidence-fabric.ts    Evidence Fabric (§5) — enforced UNVERIFIED→VERIFIED→SUPERSEDED-style status machine
  case-engine.ts        Case Engine (§4) — id-only references, enforced OPEN→INVESTIGATING→DECIDED→CLOSED lifecycle
  trust-engine.ts       computeTrustVerdict() (§34) — declared reason table, every threshold marked ASSUMED
  arbitration-engine.ts decideArbitrationAction() (§12) — verdict + context -> action + non-empty rationale
  learning-ledger.ts    Learning Ledger (§27/§29) lifecycle state machine only — CANDIDATE->VERIFIED->
                        VALIDATED->ADOPTED, REJECTED from any of the first three, SUPERSEDED/DECAYED
                        only from ADOPTED. No transition judges lesson content (docs/LEARNING_MODEL.md)
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
bun test         # 145/145 passing (12 exercise risk-replay's real client/mapping code, 13 exercise
                 # fraud-watch's real MO records, 10 exercise risk-swarm's real council output, 23
                 # exercise trust/arbitration, 1 is an end-to-end golden case, 5 exercise the shared
                 # snapshot-verification helper, 8 exercise FOMO, 8 exercise freight-risk-atlas,
                 # 11 exercise the model registry's honest-failure paths, 9 exercise the learning
                 # ledger's lifecycle state machine)
bun x tsc -b --noEmit
```

## License

MIT
