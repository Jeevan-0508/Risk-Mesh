# RISK//MESH

**A risk-intelligence fabric connecting evidence, models, investigations, decisions and outcomes without hiding provenance or disagreement.**

**[OPEN OBSERVATORY](https://jeevan-0508.github.io/Risk-Mesh/observatory/)** ·
[ARCHITECTURE](docs/MESH_ARCHITECTURE.md) · [CAPABILITY STATUS](docs/INTEGRATION_MATRIX.md)

The Observatory is the visual hero: a neural particle-orb and ledger replay remain visible while a
deterministic living briefing explains what changed in the latest completed checks of seven project
outputs. It is a provenance-labelled snapshot, not a browser-side live feed or production telemetry.

`.github/workflows/daily-state-check.yml` validates the current adapters, builds the briefing, and
refreshes the generated capability registry once per day, with a manual Run Workflow option. It
commits only meaningful source or registry changes. It does not promote `SNAPSHOT`, `SIMULATED`, or
`UNAVAILABLE` sources to `LIVE`.

Related demos: [fraud-watch](https://jeevan-0508.github.io/fraud-watch/) ·
[risk-replay](https://jeevan-0508.github.io/risk-replay/) ·
[risk-swarm](https://jeevan-0508.github.io/risk-swarm/) ·
[policy-audit](https://jeevan-0508.github.io/policy-audit/).

## Capability status

| Component | Status | Reality proven by the current code |
|---|---|---|
| Contracts | `LOCAL` | Typed MESH contracts and validation schemas |
| Evidence Fabric | `LOCAL` | Deterministic provenance and status transitions |
| Fraud Watch | `ADAPTER / SIMULATED` | Reads local synthetic world-state; outputs stay simulated |
| Risk Replay | `ADAPTER / LOCAL` | Real HTTP client; requires a reachable FastAPI backend |
| SWARM | `TRANSLATION / UNAVAILABLE` | Maps a supplied CouncilResult; MESH cannot fetch a council itself |
| FOMO | `SNAPSHOT` | Reads risk-swarm's hash-verified snapshot |
| Freight Risk Atlas | `SNAPSHOT` | Reads risk-swarm's hash-verified taxonomy snapshot |
| Policy Audit | `UNAVAILABLE / PLANNED` | No MESH adapter exists yet |
| Laya | `SHADOW / LOCAL` | Real runtime path when available; never authoritative for routing |
| Jev | `UNAVAILABLE` | No legitimate runtime access |
| Calibration | `INSUFFICIENT_DATA` | No real held-out outcome records |
| Observatory | `SNAPSHOT REPLAY` | Captured cases and runs; no production traffic |

## Living intelligence briefing

The Observatory now follows this honest path:

```text
OBSERVE → COLLECT → NORMALIZE → BRIEF → CONVERSE → INVESTIGATE → HUMAN DECIDES
```

`scripts/build-briefing.mjs` reads the generated outputs that the seven source repositories
actually publish and normalizes them into `MeshUpdate`-shaped records in
`observatory/data/briefing.js`. Its comparison state lives outside the published Pages artifact
in `data/briefing-state.json`. The current sources are FOMO, fraud-watch, shadow-network,
eu-ai-act-scanner, risk-ring, Forecast-Ledger and reg-search. Each update carries its source
project, timestamp, evidence class, source type, links, content hash, freshness and details.

The browser experience provides:

- a concise briefing beside the neural Observatory rather than a replacement dashboard;
- `NEW`, `UPDATED`, `SEEN`, `UNCHANGED` behavior backed by guarded browser-local state;
- evidence drill-down with original FOMO links, official regulatory URLs, repository outputs,
  source hashes and freshness;
- CALYPSO conversation with short memory, grounded answers, visible transcript/state transitions,
  optional browser-native voice, and explicit unavailable errors when unsupported;
- a primary FOMO record archive with every checked record and its individual original-source link,
  while technical provenance remains available behind disclosure.

The current layer does not call a model, expose a provider secret, or invent an answer. CALYPSO uses
the deterministic grounded fallback; no local LLM is installed. Laya, Jev
and SWARM escalation remain unavailable from the static Observatory until a legitimate callable
boundary exists. Fraud Watch, Shadow Network and Risk Ring remain visibly synthetic; FOMO and
Reg Search remain repository snapshots; official-source monitoring remains review-required rather
than silently changing compliance logic.

MESH's job is the layer the individual tools do not own: shared contracts, evidence/provenance,
honest trust labels, and arbitration boundaries that preserve disagreement instead of flattening it.

Implementation details remain available in [`docs/ECOSYSTEM_AUDIT.md`](docs/ECOSYSTEM_AUDIT.md),
[`docs/MESH_ARCHITECTURE.md`](docs/MESH_ARCHITECTURE.md),
[`docs/INTEGRATION_MATRIX.md`](docs/INTEGRATION_MATRIX.md),
[`docs/MODEL_ARENA.md`](docs/MODEL_ARENA.md), [`docs/CALIBRATION.md`](docs/CALIBRATION.md), and
[`docs/LEARNING_MODEL.md`](docs/LEARNING_MODEL.md) for the rest.

## What's here

```
contracts/
  schemas.ts     19 zod schemas from spec §3 (Case, Evidence, Signal, Behavior, Decision,
                 ModelResult, Disagreement, Challenge, Replay, CandidateMo, Outcome,
                 ModelOutcomeAssessment, Lesson, Knowledge, Review, Trust, Experiment,
                 ModelProfile, RepositorySource)
  validate.ts    validateMeshObject(kind, candidate) — one dispatch point for all MESH schemas
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

evaluation/calibration/
  pipeline.ts         Brier score + reliability buckets, with an explicit minimum-sample gate
  from-records.ts     provenance-checked, per-model calibration from confirmed human assessments;
                       it excludes simulated cases and never copies case-level correctness labels

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
bun test         # 223 declared native test cases across 37 files; passing status is NOT VERIFIED
                 # in this runtime because Bun is unavailable. The suite includes adapter,
                 # provenance, model-registry, arena, ledger, and golden-case coverage.
bun x tsc -b --noEmit
```

## Author

**Jeevan Siddhabhaktula** ([github.com/Jeevan-0508](https://github.com/Jeevan-0508))

## License

MIT, Copyright (c) 2026 Jeevan Siddhabhaktula (see [LICENSE](LICENSE))
