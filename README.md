<p align="center"><img src="assets/jk-brand-banner.png" alt="Jeevan Siddhabhaktula: Risk. Governance. AI." width="280"></p>

# RISK//MESH

**The connective fabric between independent risk systems — contracts, evidence, provenance and
arbitration, not another engine.**

MESH itself has one small UI of its own - **[Observatory](https://jeevan-0508.github.io/Risk-Mesh/)**
([`observatory/`](observatory/) source), a replay (not a live feed)
of its two real golden cases, plus two real System-1 Arena runs against real fraud-watch MOs,
through a particle-orb + terminal-log visualization, see
[`docs/MESH_ARCHITECTURE.md`](docs/MESH_ARCHITECTURE.md#observatory-phase-19--small-slice-implemented-a-live-cross-system-dashboard-still-planned)
for exactly what it does and doesn't show.

Live demos of the systems MESH connects (it otherwise has no UI beyond that replay, being a backend
contract/evidence layer): [fraud-watch](https://jeevan-0508.github.io/fraud-watch/) ·
[risk-replay](https://jeevan-0508.github.io/risk-replay/) ·
[risk-swarm](https://jeevan-0508.github.io/risk-swarm/) ·
[policy-audit](https://jeevan-0508.github.io/policy-audit/).

RISK//MESH does not simulate fraud, run counterfactual replay, or classify governance evidence —
[fraud-watch](https://github.com/Jeevan-0508/fraud-watch),
[risk-replay](https://github.com/Jeevan-0508/risk-replay), and
[policy-audit](https://github.com/Jeevan-0508/policy-audit) already do those, well, with their own
test suites. MESH's job is the layer none of them have a reason to own: a shared contract every
system's records can be mapped into, an evidence/provenance model with an honest six-value trust
label, and (once real cases exist) a trust/arbitration layer that reasons *across* systems.

## Status: Phases 1-4 (contracts, evidence fabric, case engine, ledger) + risk-replay adapter (Phase 7) + fraud-watch adapter (Phase 5) + risk-swarm adapter (Phase 6) + trust/arbitration engines (Phase 11) + two golden cases (Phase 20 slice) + FOMO and freight-risk-atlas snapshot adapters + model registry (Phases 8-10; all 3 Laya checkpoints are real, live SHADOW connections as of 2026-09-23, see below) + System-1 Arena (`evaluation/system1-arena/`, live as of 2026-09-23) + System-1 shadow routing (`decideSystem1Action()`, 2026-09-23) + a real fraud-watch-to-System-1 integration (`evaluation/system1-arena/fraud-watch-cases.ts`, 2026-09-23) + a calibration pipeline (`evaluation/calibration/pipeline.ts`, real math, honestly `INSUFFICIENT_DATA` today) + an outcome engine (`core/outcome-engine.ts`, 2026-09-23, gives `CaseEngine.setOutcome()` its first real caller - still no real MESH `Outcome` records exist yet, calibration stays `INSUFFICIENT_DATA` until one is recorded) + learning/knowledge lifecycle engines (Phases 12-13, with the PROVISIONAL-forever guard LEARNING_MODEL.md requires) + Observatory (Phase 19 slice, live at the link above, now also replaying a real System-1 Arena run against real fraud-watch MOs)

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
snapshot sync, so MESH never re-syncs from those two repos directly). Laya and Jev are registered
in `adapters/model-registry/`: all 3 registered Laya checkpoints (`laya-typed`, `laya-english`,
`laya-multilingual`) are real, live connections (the actual `laya` PyPI package calling their real
`convaiinnovations/*` checkpoints on HuggingFace, status `SHADOW` — connected and real, not yet
authoritative for routing); Jev stays honestly `UNAVAILABLE` (its real identity — TypeSafe AI,
invite-only — was researched and confirmed, access simply isn't obtainable here). A real
System-1 Arena (`evaluation/system1-arena/`) calls 2+ of these independently for the same case and
builds a real `Disagreement` when they don't agree, never averaging it away. See
[`docs/MODEL_ARENA.md`](docs/MODEL_ARENA.md) for the full status. No fabricated results exist
anywhere in this repo.

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
  registry.ts       the 5 real ModelProfile entries from docs/MODEL_ARENA.md (3 Laya checkpoints +
                     jev + open-jev); all 3 Laya checkpoints are status:'SHADOW',
                     provenance.source:'LIVE' — jev/open-jev stay status:'UNAVAILABLE'
  laya-runtime.ts   real Laya inference: spawns scripts/laya_infer.py (the actual laya PyPI
                     package) as a subprocess, plus a pure fixture-testable raw-to-ModelResult mapper
  client.ts      callModel() succeeds for any SHADOW Laya checkpoint (looked up from the registry,
                 not hardcoded); jev/open-jev/unknown ids still fail closed to UNAVAILABLE, never a
                 fabricated ModelResult (spec §9/§10)
  adapter.ts     composes registry+client: assessModelCall(), registryStatusSummary()
  live-smoke.ts  opt-in real end-to-end call (bun run laya:smoke), not part of bun test
  __fixtures__/  3 real captured inference calls (one per Laya checkpoint), see PROVENANCE.md there
  *.test.ts      real subprocess calls are dependency-injected out in tests (fixture-backed), so
                 the default suite stays fast/green without needing torch/uv/network installed

evaluation/system1-arena/
  compare.ts          compareModelResults() — pure comparison over 2+ ModelResults for the same
                       case; agreement gets a score, disagreement becomes a real Disagreement
                       object (§35), never averaged or majority-voted away
  run.ts              runSystem1Arena(modelIds, input, deps?) — calls assessModelCall() once per
                       model_id, structurally independent (no model ever sees another's result);
                       needs 2+ real ok:true results or fails closed with the real per-model
                       failure reasons
  fraud-watch-cases.ts a real fraud-watch Behavior -> Laya/Arena call -> decideSystem1Action()
                       recommendation, end to end — the first real call site for System-1 shadow
                       routing; never exposes fraud-watch's own confidence/investigation fields to
                       Laya, only the same description text a human reviewer would see
  *.test.ts           18 tests: pure comparison logic, a genuine 2- and 3-model arena run against
                       the real Laya checkpoints via injected fixture-backed runners, and the
                       fraud-watch integration end to end against a real captured MO-0001 fixture

core/
  store.ts             generic in-memory MeshStore<T> (add/get/list/replace, rejects duplicate ids)
  ledger.ts             append-only event ledger (§42) — no update/delete method exists on the class
  evidence-fabric.ts    Evidence Fabric (§5) — enforced UNVERIFIED→VERIFIED→SUPERSEDED-style status machine
  case-engine.ts        Case Engine (§4) — id-only references, enforced OPEN→INVESTIGATING→DECIDED→CLOSED lifecycle
  trust-engine.ts       computeTrustVerdict() (§34) — declared reason table, every threshold marked ASSUMED
  arbitration-engine.ts decideArbitrationAction() (§12) — verdict + context -> action + non-empty rationale;
                        decideSystem1Action() (System-1 directive) — a shadow-mode-only sibling: Laya/Arena
                        signals -> a recommended action, never wired into a case's real Decision yet
                        (laya-typed/-english/-multilingual are SHADOW, not LIVE-authoritative)
  learning-ledger.ts    Learning Ledger (§27/§29) lifecycle state machine only — CANDIDATE->VERIFIED->
                        VALIDATED->ADOPTED, REJECTED from any of the first three, SUPERSEDED/DECAYED
                        only from ADOPTED. No transition judges lesson content (docs/LEARNING_MODEL.md)
  knowledge-ledger.ts   Knowledge (§28/§51) lifecycle state machine; transition table explicitly
                        labeled ASSUMED in its own comment (no diagram exists in this repo for it,
                        unlike Lesson's) — modelled on evidence-fabric.ts's closest precedent
  __golden__/           two golden cases (§48): the first wires contracts/evidence/case/ledger/
                        risk-replay over a real fixture end to end; the second continues from the
                        same real replay finding into a Lesson, and proves the PROVISIONAL-forever
                        guard actually fires, not just in the guard's own unit test
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
bun test         # 200/200 passing (12 exercise risk-replay's real client/mapping code, 13 exercise
                 # fraud-watch's real MO records, 10 exercise risk-swarm's real council output, 33
                 # exercise trust/arbitration incl. decideSystem1Action's shadow-mode routing, 2 are
                 # end-to-end golden cases, 5 exercise the shared snapshot-verification helper, 8
                 # exercise FOMO, 8 exercise freight-risk-atlas, 28 exercise the model registry incl.
                 # all 3 Laya checkpoints' real (fixture-backed) success paths and the pure
                 # entropy/mapping helpers against real captured fixtures, 18 exercise the System-1
                 # Arena (comparison logic, a genuine multi-model run, and the real fraud-watch ->
                 # System-1 integration end to end), 11 exercise the learning ledger's lifecycle
                 # state machine including the PROVISIONAL-forever guard, 7 exercise the knowledge
                 # ledger's lifecycle state machine)
bun x tsc -b --noEmit
```

## License

MIT
