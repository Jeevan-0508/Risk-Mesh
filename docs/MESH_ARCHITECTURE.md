# MESH ARCHITECTURE

Scope note: this describes the architecture MESH is being built toward. Only Phase 1 (contracts) is
implemented as of this document's date (2026-09-23). Everything else here is design, explicitly
flagged as `PLANNED` — nothing in this file describes code that exists yet beyond `contracts/`.

## Position in the ecosystem

MESH is not a 15th risk system. It owns none of: simulation (fraud-watch), investigation (risk-swarm),
counterfactual replay (risk-replay), governance evidence (policy-audit), risk registers (risk-os),
network intelligence (risk-ring), external signal scanning (FOMO), or domain taxonomy
(freight-fraud-taxonomy / freight-risk-atlas). Per the ecosystem audit, several of those already
implement pieces of what a naive reading of the MESH spec would ask MESH to build again (evidence
tiers, disagreement types, provenance-hashed sync). MESH's job is the connective tissue those systems
do not have today:

1. A **Case** object that can reference records from more than one system with typed, versioned links.
2. An **Evidence Fabric** contract that any adapter can populate, with the same UNVERIFIED → VERIFIED
   → CONTRADICTED → SUPERSEDED → REJECTED status machine regardless of which system produced the
   evidence.
3. An **append-only ledger** of cross-system events (a case entering the fabric, an adapter attaching
   evidence, a disagreement being recorded, a lesson being proposed/validated).
4. A **model registry + arena** for System-1 checkpoints (Laya family, Jev, future models) that none
   of the existing repos have any reason to own, since none of them talk to those checkpoints.
5. A **trust/arbitration layer** that reasons across adapters' outputs (e.g. "risk-swarm's council
   disagreed AND risk-replay found the decision fragile under replay" → escalate), which by
   definition cannot live inside any single existing repo.

## Layers

```
                        RISK//MESH
                              │
      ┌───────────────────────┼───────────────────────┐
      │                       │                       │
   ADAPTERS               MESH CORE                OBSERVATORY
      │                       │                       │
 read-only, one            contracts               (PLANNED,
 direction per §0:         case engine              Phase 19)
 no repo is rewritten,     evidence fabric
 no repo is written to     ledger
 without a human import    trust/arbitration
 step (mirrors riskos.ts)  learning ledger (PLANNED)
                           memory (PLANNED)
```

### Contracts (Phase 1 — IMPLEMENTED)

`contracts/` defines the 17 schemas from MESH spec §3 as zod schemas (matching risk-swarm's own
convention of "zod is the single source of truth; types are inferred, never hand-duplicated"). Every
schema extends a common `MeshBase` shape: `id`, `schema_version`, `created_at`, `source`,
`provenance`, `status`. See `contracts/schemas.ts` and its tests for the authoritative definition —
this document does not restate field lists that can drift from the code.

### Evidence Fabric (Phase 2 — IMPLEMENTED)

`core/evidence-fabric.ts`. Evidence enters only through `add()`; `transition()` enforces a real state
machine (`UNVERIFIED → VERIFIED|CONTRADICTED|REJECTED`, `VERIFIED → CONTRADICTED|SUPERSEDED`,
`CONTRADICTED → SUPERSEDED|REJECTED`, `SUPERSEDED`/`REJECTED` terminal) — an illegal jump (e.g.
UNVERIFIED straight to SUPERSEDED, or any move out of a terminal state) throws
`IllegalTransitionError` rather than silently succeeding. Every add/transition writes a ledger event.

### Case engine (Phase 3 — IMPLEMENTED)

`core/case-engine.ts`. A case stores only ids (`evidence_ids`, `decision_ids`, `disagreement_ids`,
`challenge_ids`, `replay_ids`, `lesson_ids`, `outcome_id`) — `attach*()` methods are idempotent and
append-only, and `transitionStatus()` enforces the real lifecycle
(`OPEN → INVESTIGATING → DECIDED → CLOSED`, with `REOPENED` re-entering at `INVESTIGATING`, never
skipping back to `DECIDED`). Reconstructing a case means resolving those ids back through the
evidence fabric / other stores — never copying the underlying record into the case itself.

### Adapters (Phases 5-9 — PLANNED, scoped by the audit)

Each adapter is **read-only against the source repo** and follows the `riskos.ts` precedent already
established in risk-swarm: it produces a MESH-shaped object from the source system's real exported
data, and if a value can't be honestly known it is `null` with an explanation, never invented.

| Adapter | Mechanism | Status |
|---|---|---|
| risk-swarm | No fetch step — risk-swarm has no server and pushes no persisted council/decision export (runs in-browser against a user's own BYOK key). Type-level mirror of `CouncilResult` + pure mapping functions taking an already-produced result and an explicit `provenanceSource` | **IMPLEMENTED** — `adapters/risk-swarm/{types,map,adapter}.ts`, tested against real captures of risk-swarm's own `runCouncil()` (majority-disagreement + degraded-agent scenarios, same fetch-mock technique as its own test suite) |
| risk-replay | HTTP calls to the real FastAPI backend (`backend/app/api/main.py`) | **IMPLEMENTED, live-verified** — `adapters/risk-replay/{client,map,adapter}.ts`, run `bun test` with `RISK_REPLAY_API_BASE_URL` set to a running instance |
| fraud-watch | Read `data/world-state.json` directly (fraud-watch is static, no server); map real `moEngine.mos` records to `Behavior` (§16), not to `CandidateMo` (§17) — that earlier "candidate-MO shape doesn't exist" note was wrong, `moEngine.mos` was already there, just under `Behavior`'s vocabulary rather than `CandidateMo`'s | **IMPLEMENTED** — `adapters/fraud-watch/{client,map,adapter}.ts`, tested against a real captured `world-state.json` (fraud-watch@880a12f); every output `Behavior` is unconditionally `simulated: true` |
| FOMO | Read risk-swarm's own hash-verified `public/snapshots/fomo/signals.json` via the shared `adapters/_shared/snapshot-provenance.ts` helper, rather than re-syncing from FOMO's repo directly | **IMPLEMENTED** — `adapters/fomo/{client,map,adapter}.ts`, tested against a real trimmed fixture; every output `Signal` is unconditionally `status: 'RAW'` (§24, Rule 4) |
| freight-risk-atlas | Read risk-swarm's own hash-verified `public/snapshots/freight-risk-atlas/taxonomy.json` via the same shared helper; `taxonomyVersionRecord()` feeds `CandidateMo.taxonomy_version`/`taxonomy_hash` (§17) from risk-swarm's already-verified sha256 | **IMPLEMENTED** — `adapters/freight-risk-atlas/{client,map,adapter}.ts`, tested against a real trimmed 2-pattern fixture |
| policy-audit | Read exported evidence/control/finding objects (must confirm policy-audit has an export path — not yet verified in Phase 0) | PLANNED |
| risk-os | Read the existing `src/domain/types.ts` risk-register model (already typed) | PLANNED |
| Laya / Jev | HTTP/local-runtime adapters against real checkpoints — **cannot be built against fabricated responses**; blocked until credentials/runtime exist | **Registry IMPLEMENTED** — `adapters/model-registry/{registry,client,adapter}.ts`: 5 real `ModelProfile` entries (3 Laya checkpoints + jev + open-jev), every one `NOT_CONNECTED`; `callModel()` has no success path. Live call itself stays BLOCKED, NOT_CONNECTED |

### Trust & arbitration (Phase 11 — IMPLEMENTED)

`core/trust-engine.ts` computes a `TrustVerdict` from `TrustDrivers` (§34): a declared-order reason
table, same convention as fraud-watch's own `CLASSIFICATION_REASONS`, with every threshold marked
`ASSUMED` because no MESH-measured historical outcomes exist yet anywhere in this ecosystem.
`core/arbitration-engine.ts` turns that verdict plus `ArbitrationContext` (is risk-swarm actually
reachable, has replay already run, is there a nameable evidence gap) into one `ACCEPT | CONDITIONAL |
ESCALATE_TO_SWARM | REQUEST_MORE_EVIDENCE | REQUEST_REPLAY | HUMAN_REVIEW | ABSTAIN`, always with a
non-empty rationale (§12). `swarmAvailable` defaults to what's actually true today — `false` — rather
than assuming a connection that doesn't exist.

### Ledger (Phase 4 — IMPLEMENTED)

`core/ledger.ts`. Append-only event log per MESH spec §42 — there is no `update`/`delete` method on
the class at all (a test asserts this directly, not just by convention). Every ledger event is one of
the 17 types spec §42 names; `Ledger.forCase(id)` and `.ofType(type)` are the two query shapes built
so far.

### Golden cases (Phase 20, two slices — IMPLEMENTED)

`core/__golden__/dec-001-fragile-replay.test.ts` wires all of the above together over one real
captured risk-replay decision (`DEC-001`, risk-replay's own seeded demo data, explicitly labelled
`SIMULATED`): create a case, add its real evidence via the risk-replay adapter mapping, attach a real
counterfactual-derived `Replay` (status `FRAGILE`), then reconstruct the case and confirm the ledger
trail matches exactly what happened. This is the first (very small) proof that the connective tissue
actually connects, not just that each piece has its own unit tests.

A second golden case, `dec-001-lesson-provisional.test.ts`, continues from the same real replay
finding into a proposed `Lesson`, walks it CANDIDATE -> VERIFIED -> VALIDATED via
`LearningLedger`, then asserts that attempting VALIDATED -> ADOPTED throws `ProvisionalLessonError`
- proving the connective tissue actually enforces LEARNING_MODEL.md's PROVISIONAL-forever rule end
to end, not just in the guard's own unit test. It also asserts `KnowledgeLedger.record()` is
correctly never called, since no ADOPTED lesson exists to promote from.

### Memory / Learning (Phases 12-13 lifecycle engines — IMPLEMENTED; validation/benchmark content — PLANNED)

Full lifecycle from spec §27-§29. `core/learning-ledger.ts` implements just the state machine
(`LessonStatus`: CANDIDATE -> VERIFIED -> VALIDATED -> ADOPTED, REJECTED from any of the first three,
SUPERSEDED/DECAYED only from ADOPTED) - the same honest scope `case-engine.ts`/`evidence-fabric.ts`
already established, no transition inspects or judges lesson content. Deliberately still deferred: a
learning system needs real outcome data to
learn from, and MESH has produced zero real cases yet. Building the validation/decay machinery before
there is anything real to validate would be speculative code with no way to test it meaningfully.
`core/knowledge-ledger.ts` (Phase 13) is the same pure state machine for `KnowledgeStatus`, with its
transition table explicitly labeled ASSUMED (no spec §28/§51 diagram exists in this repo, unlike
Lesson's) rather than silently presented as derived from a source that isn't available here.

### Observatory (Phase 19 — small slice IMPLEMENTED, a live cross-system dashboard still PLANNED)

A dashboard over an empty or synthetic
ledger would misrepresent the project's actual state, which the "no fake integrations" rule (§58)
extends to the UI as much as to adapters — so the full Observatory (a live view over real
cross-system traffic) stays deferred until MESH actually processes real cases.

What *is* honest to build now: `observatory/` is a small static page (Three.js particle orb +
scrolling terminal log) that replays the two real golden cases from
`observatory/data/golden-cases.js`, generated by `observatory/scripts/capture-golden-events.ts`
from the exact same `core/__golden__/scenarios.ts` the golden-case tests assert against — not a
second hand-typed version of events that could drift from what actually happened. It is explicitly
labelled throughout as a replay of a past test run, never as a live feed, and shows the
`ProvisionalLessonError` guard actually firing in the same terminal log a real ledger trail
appears in. Regenerate the data file (`bun run observatory:capture`) after any change to the
scenarios or the engines they exercise. Published via GitHub Actions
(`.github/workflows/deploy-observatory.yml`) on every push that touches `observatory/`.

Two more tabs (`observatory/data/system1-cases.js`, generated by
`observatory/scripts/capture-system1-events.ts`, `bun run observatory:capture:system1`) replay a
real System-1 Arena run - real Laya inference against two real fraud-watch MOs
(`evaluation/system1-arena/fraud-watch-cases.ts`) - through to `decideSystem1Action()`'s shadow
recommendation. The capture script uses a fixture-backed `layaRunner` that replays the exact real
captures in `adapters/model-registry/__fixtures__/PROVENANCE.md` rather than re-spawning a
subprocess on every build - same "replay a real run, never fabricate" rule as the golden cases,
just with a model call in the loop instead of only ledger events. Both real MOs land on a genuine
model disagreement (`laya-multilingual` answers `normal` while the other two lean `investigate`,
consistent with its documented lower accuracy) and both honestly route to `HUMAN_REVIEW` -
`swarmAvailable` defaults to `false` everywhere in this repo today, so this is the real result, not
adjusted for visual variety. `decideSystem1Action()`'s output is a SHADOW recommendation only;
nothing in this repo wires it into a case's authoritative Decision yet.

## What is explicitly NOT being built yet

- No model is being fine-tuned (§54) — not applicable until far later, if ever.
- No self-improvement loop (§30, §37) — needs the learning ledger and real cases first.
- No Laya/Jev live results anywhere in the UI — both show `UNAVAILABLE`/`NOT_CONNECTED` until real
  credentials exist.
