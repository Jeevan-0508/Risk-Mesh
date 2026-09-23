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

### Evidence Fabric (Phase 2 — PLANNED)

Evidence enters through an adapter, never as a bare model output. The status machine
(`UNVERIFIED | VERIFIED | CONTRADICTED | SUPERSEDED | REJECTED`) is enforced by the `Evidence` schema
already defined in Phase 1; the fabric itself (storage + status transition rules + provenance chain
lookups) is not yet built.

### Case engine (Phase 3 — PLANNED)

A case aggregates evidence, decisions, disagreements, challenges, replays and outcomes by id
reference, never by copying the underlying record. Reconstructing a case means resolving those ids
back through each adapter (or the ledger, for anything the adapter no longer has live).

### Adapters (Phases 5-9 — PLANNED, scoped by the audit)

Each adapter is **read-only against the source repo** and follows the `riskos.ts` precedent already
established in risk-swarm: it produces a MESH-shaped object from the source system's real exported
data, and if a value can't be honestly known it is `null` with an explanation, never invented.

| Adapter | Mechanism | Status |
|---|---|---|
| risk-swarm | Read risk-swarm's own snapshot files + council/decision output (risk-swarm already exports some of this) | PLANNED |
| risk-replay | HTTP calls to the real FastAPI backend (`backend/app/api/main.py`) | **IMPLEMENTED, live-verified** — `adapters/risk-replay/{client,map,adapter}.ts`, run `bun test` with `RISK_REPLAY_API_BASE_URL` set to a running instance |
| fraud-watch | Read `data/{fraud-data.json, simulation-log.jsonl, world-state.json}`; candidate-MO shape does not exist in fraud-watch today and would need to be added there first, or derived by the adapter from simulation-log entries — open design question, not solved by this doc | PLANNED |
| policy-audit | Read exported evidence/control/finding objects (must confirm policy-audit has an export path — not yet verified in Phase 0) | PLANNED |
| risk-os | Read the existing `src/domain/types.ts` risk-register model (already typed) | PLANNED |
| Laya / Jev | HTTP/local-runtime adapters against real checkpoints — **cannot be built against fabricated responses**; blocked until credentials/runtime exist | BLOCKED, NOT_CONNECTED |

### Trust & arbitration (Phase 11 — PLANNED)

Deterministic function over: adapter outputs, evidence completeness, historical calibration (requires
enough MESH-measured outcomes to exist — none yet), novelty, replay stability (from the risk-replay
adapter). Output is one of `ACCEPT | CONDITIONAL | ESCALATE_TO_SWARM | REQUEST_MORE_EVIDENCE |
REQUEST_REPLAY | HUMAN_REVIEW | ABSTAIN`, each with a stated reason.

### Ledger (Phase 4 — PLANNED)

Append-only event log per MESH spec §42. Corrections are new events, not edits.

### Memory / Learning (Phases 12-13 — PLANNED)

Full lifecycle from spec §27-§29. Deliberately deferred: a learning system needs real outcome data to
learn from, and MESH has produced zero real cases yet. Building the validation/decay machinery before
there is anything to validate would be speculative code with no way to test it meaningfully.

### Observatory (Phase 19 — PLANNED)

Deferred until there is real cross-system data to observe. A dashboard over an empty or synthetic
ledger would misrepresent the project's actual state, which the "no fake integrations" rule (§58)
extends to the UI as much as to adapters.

## What is explicitly NOT being built yet

- No model is being fine-tuned (§54) — not applicable until far later, if ever.
- No self-improvement loop (§30, §37) — needs the learning ledger and real cases first.
- No Laya/Jev live results anywhere in the UI — both show `UNAVAILABLE`/`NOT_CONNECTED` until real
  credentials exist.
