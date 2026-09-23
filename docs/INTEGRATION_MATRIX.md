# INTEGRATION MATRIX

Status values used below (per MESH spec §58, the UI/docs must distinguish these, not blur them):

- **LIVE** — a real running connection exists today.
- **SNAPSHOT** — real data, copied via a provenance-hashed sync step (like risk-swarm's
  `sync-snapshots.mjs`), not a live call.
- **PLANNED** — designed, not built.
- **BLOCKED** — cannot be built honestly right now (missing credentials/runtime).
- **NOT_CONNECTED** — no integration exists anywhere in the ecosystem today.

| System | Today (found in Phase 0) | MESH plan | Status |
|---|---|---|---|
| risk-swarm | Already snapshot-syncs FOMO, freight-risk-atlas, ai-governance-control-room; has its own council/disagreement/evidence-tier model | MESH reads risk-swarm's decision/council output via the same snapshot mechanism it already uses to receive from others | PLANNED |
| risk-replay | Real FastAPI backend, 13 engines, SQLAlchemy persistence | **Built and live-verified** (`adapters/risk-replay/`): ran the real backend locally (`uv run uvicorn app.api.main:app`), called `/decisions/DEC-001/counterfactual` for real, captured the response as a fixture. Removing evidence `E3` flips DEC-001 BLOCK→ALLOW; risk-replay's own `causal_engine.py` returns `causal_status: DECISION_CRITICAL` with the exact phrase spec §18 anticipates ("decision-critical under the replay model"). Discovered risk-replay's real `MutationType` enum only partially overlaps MESH's (5 of 9/10 values agree) — mapped only the five that mean the same thing, left the rest explicitly unmapped rather than guessed. | **LIVE** (adapter built; requires the backend running locally, `RISK_REPLAY_API_BASE_URL` env var) |
| policy-audit | Client-side framework/control/evidence engine; export path not yet verified | MESH sends case+decision, receives governance findings, once an export/import path is confirmed to exist | PLANNED |
| fraud-watch | Simulation producing `fraud-data.json`/`simulation-log.jsonl`; no "candidate MO" object type in code today | Candidate-MO pipeline (§17) needs that object type to exist somewhere first — either fraud-watch adds it, or the adapter derives one from simulation-log entries. Undecided. | PLANNED, design gap |
| risk-os | Own typed risk-register domain model + validators | MESH proposes candidate risks in the exact shape risk-swarm's `riskos.ts` already uses — reuse that contract rather than invent a second one | PLANNED |
| risk-ring | Trained classifier + graph, own test suite (3 files) | Association/correlation/suspicion/validated-relationship distinction (§23) read from risk-ring's own graph output | PLANNED |
| FOMO | Already feeds risk-swarm today | MESH treats FOMO output as untrusted external signal → Evidence Fabric, per §24 — never as instruction | PLANNED |
| freight-fraud-taxonomy / freight-risk-atlas | Already the taxonomy source risk-swarm syncs (hashed) | MESH reuses that same hash/version record rather than re-hashing independently | PLANNED |
| ai-governance-control-room | Already snapshot-synced into risk-swarm | Portfolio-level control plane per §20 — MESH exposes records *to* it rather than pulling from it | PLANNED |
| forecast-ledger | Python, sealing/grading logic in `METHODOLOGY.md`/`SPEC.md`, not yet code-verified | MESH-issued forecasts get sealed there; not started | PLANNED |
| Laya (3 checkpoints) | Never integrated anywhere in the ecosystem | Adapter + shadow mode | BLOCKED — no HF runtime/credentials in this environment |
| Jev / open-jev family | Never integrated anywhere in the ecosystem | Adapter, empirical comparison against Laya | BLOCKED — no Jev API access |
| hakai-protocol-v2, hakai_world | Explicitly OPTIONAL/FUTURE in the directive | Deferred | NOT_CONNECTED, out of scope for now |

## Honesty rule enforced in code, not just docs

The `Provenance` contract (Phase 1) requires every MESH object to carry a `provenance.source` that is
one of `LIVE | SNAPSHOT | SIMULATED | MOCKED | CACHED | UNAVAILABLE` (see `contracts/schemas.ts`). The
schema cannot verify that a claimed label is *true* (no type system can), but it does close one real
gap: nobody can produce a valid MESH object with a blank, missing, or invented seventh label — every
object is forced to pick one of these six honest words, and any adapter for a BLOCKED integration
(Laya, Jev today) has no way to emit anything at all until it exists, so there is nothing to mislabel.
