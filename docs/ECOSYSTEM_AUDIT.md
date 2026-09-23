# ECOSYSTEM AUDIT — RISK//MESH Phase 0

Generated 2026-09-23 by inspecting the actual local clones of each repository (source code, package
manifests, test directories), not README claims. Every repo below is a real git clone with an
`origin` remote pointing at `github.com/Jeevan-0508/<repo>` and a local commit history.

## Method

For each repo: read `package.json`/`pyproject.toml`/`requirements.txt` where present, list the
top-level tree, count real test files, and open the core source modules that look most relevant to
MESH (adapters, domain models, evidence handling). No repo was modified. No number below is copied
from a README badge without being re-derived from the filesystem.

## Repo-by-repo findings

| Repo | Stack | Tests found | Server/API? | Notes |
|---|---|---|---|---|
| **risk-swarm** | React+TS, Vite, bun test, zod | 60 `.test.ts` | No (client-only) | Already implements most of what §0-§15 of the MESH spec asks for. See "Major finding" below. |
| **risk-replay** | Python FastAPI + SQLAlchemy backend, React frontend | 47 `test_*.py` | **Yes** — `backend/app/api/main.py`, `api/schemas.py`, 13 named engines (`replay_engine.py`, `mutation_engine.py`, `causal_engine.py`, `counterfactual_engine.py`, `diff_engine.py`, `decision_engine.py`, `governance_engine.py`, `incident_engine.py`, `integrity_engine.py`, `risk_engine.py`, `sweep_engine.py`, `dna_engine.py`, `boundary_engine.py`) | Only repo in the ecosystem with a real running server + ORM. Only real HTTP-integration candidate. |
| **policy-audit** | React+TS, bun test | 2 `.test.ts` | No (client-only, browser parses uploaded docs) | `src/core/{frameworks,engine,extraction,parsers,security,golden,llm,report}` — framework/control/evidence engine already exists. |
| **fraud-watch** | Vanilla JS, no build | 1 test file | No | `js/{core,entities,simulation,systems,world}` — simulation-only; `data/{fraud-data.json, simulation-log.jsonl, world-state.json}` are the only exportable artifacts found. No "candidate MO" object type exists yet in code. |
| **riskos (risk-os)** | React+TS, bun test | present under `src/test` | No | `src/domain/{engines,types.ts,validate.ts}` — has its own risk register domain model + validators already. |
| **ai-governance-control-room** | Vanilla JS/static | 0 in `tests/` dir found empty of `.test.ts` (has a `tests/` folder, format unconfirmed) | No | Framework/control/evidence data model, consumed today by risk-swarm via snapshot (see below). |
| **forecast-ledger** | Python, static site | 24 test files under `tests/` | No | Has `METHODOLOGY.md` and `SPEC.md` — sealing/grading logic described in prose, not yet inspected line-by-line. |
| **risk-ring** | Python (graph/model/simulate) | 3 `test_*.py` (`test_features`, `test_graph`, `test_simulate`) | No | `graph/`, `model/`, `simulate/` — trained classifier + NetworkX graph, already has real ground truth per its own README claim (not yet independently re-verified). |
| **FOMO** | Python scripts + static dashboard | 0 | No | `scanner.py`, `build_dashboard.py`, `reclassify_existing.py` — produces `data/signals.json`, which risk-swarm already consumes. |
| **freight-fraud-taxonomy** | Static data + docs | 0 | No | `taxonomy/` — versioned pattern/indicator/false-positive/countermeasure data, already consumed by risk-swarm via `freight-risk-atlas/taxonomy.json` snapshot. |
| **freight-risk-atlas** | Static site | 0 | No | Consumes the taxonomy above; exposes `data/taxonomy.json`, which is the file risk-swarm actually syncs. |
| **eu-ai-act-scanner** | Vanilla JS PWA | 0 | No | Self-contained browser scanner; no exportable case data found. |
| **gdpr (gdpr-compliance-scanner)** | Vanilla JS PWA | 0 | No | Same shape as the AI-Act scanner. |
| **dora-compliance-scanner** | Static + `tests/` dir | present, format unconfirmed | No | Same family as ai-governance-control-room. |
| **ruleshift** | React+TS game | 7 `.test.ts` | No | A puzzle game (rule-shifting mechanics), not a risk system. Out of scope for MESH data flow; included only because it was named in the directive's optional list style. Not integrated. |

Not inspected in depth (out of the Phase-0 time budget, no evidence of MESH relevance beyond being
named in the directive): `hakai-protocol-v2`, `hakai_world` — both explicitly marked OPTIONAL/FUTURE
in the directive itself, so deferred without loss.

## Major finding: risk-swarm already implements a large slice of "MESH"

This is the single most important Phase-0 result, and it changes the shape of the plan below.

Reading `risk-swarm/src/core/` turned up, **already built and tested**, real code that maps directly
onto sections of the MESH spec:

- **Evidence tiering** (`src/core/domain/model.ts`): a 5-tier source model (`regulator` … `llm_reasoning`)
  with a fixed `TIER_OF_SOURCE_TYPE` map and `TIER_WEIGHT` where LLM reasoning is explicitly weighted
  `0` — i.e. "no model output becomes evidence" (MESH §5, Rule 4) already exists as executable code,
  not just a principle.
- **Multi-agent disagreement as a first-class object** (`src/core/council/types.ts`): `OlympianPosition`
  (per-agent stance/confidence/claims/evidence_ids), `CouncilVerdict` with `verdict_type` in
  `CONSENSUS | MAJORITY | MINORITY_PRESERVED | UNRESOLVED`, and `DisagreementAssessment` with
  `agreement: strong_consensus | majority | split | inconclusive`. This is MESH §11/§35
  (disagreement-as-signal, never average it away) already implemented for the ATHENA/ARES/HADES/ZEUS
  council.
- **Citation fabrication fencing**: `assertNoFabricatedCitations` (referenced in `council/types.ts`
  doc comments) rejects any `evidence_ids` not actually supplied — this is MESH §39's
  "citation fabrication" defense, already live.
- **Cross-repo provenance-hashed sync** (`scripts/sync-snapshots.mjs` + `public/snapshots/provenance.json`):
  a real, working adapter mechanism that copies published data files from sibling repo clones,
  records `upstream_repo`, `commit`, and a `sha256` per file, and never mutates the upstream repo.
  It currently syncs **FOMO** (`signals.json`), **freight-risk-atlas** (`taxonomy.json`), and
  **ai-governance-control-room** (`controls.json`, `frameworks.json`). This is close to MESH §6's
  provenance chain and §25's taxonomy hashing/versioning requirement, already running in production
  for 3 of the 4 repos MESH names.
- **A deliberate one-way export sink** (`src/core/integrations/riskos.ts`): produces a
  `riskos.risk-candidate` object from a human-accepted decision, and explicitly writes `ownerId: null`
  / `workstreamId: null` with an `import_instructions` field rather than inventing values the source
  system can't know. It never writes into risk-os directly — a human imports it. This is MESH §46
  (human remains authoritative) already implemented as the pattern, not just documented.

**Consequence for the plan**: the MESH directive's own Section 0 rule — "do NOT rewrite working
systems merely to make them look consistent" — applies most strongly here. Re-implementing evidence
tiers, disagreement types, or a citation fence inside a new `risk-mesh` repo would be exactly the
duplication the directive prohibits. MESH's real, non-redundant job is:

1. A **shared contract layer** (Phase 1) that risk-swarm's types, risk-replay's `api/schemas.py`, and
   policy-audit's control/evidence types can all be mapped *into*, without any of the three repos
   being rewritten.
2. **Filling the actual gaps**: no repo today has a cross-cutting `Case` object that spans more than
   one system; no repo talks to risk-replay's live API (everything else is snapshot/static); nothing
   in the ecosystem references Laya or Jev in any form (see below); there is no event ledger, no
   learning-lesson validation lifecycle, and no trust/arbitration layer that reasons across systems
   rather than within one.

## Laya / Jev status

Searched every local clone for `laya`, `jev`, `convaiinnovations` (case-insensitive). No genuine hits:
matches were false positives (`bun.lock` substrings, the word in unrelated README prose). **No repo in
the ecosystem has ever integrated Laya or Jev.** This sandbox also has no HuggingFace credentials or
local inference runtime configured, and no Jev API key.

Per the directive's own §58 ("no fake integrations") and §9/§10 ("never fabricate Jev results, never
simulate and present as live"):

    LAYA_STATUS = NOT_CONNECTED
    JEV_STATUS  = NOT_CONNECTED

Both remain architecture-only (model registry entries, adapter interfaces) until real credentials/
runtime are available and Jeevan chooses to wire them up. No shadow-mode numbers will be invented to
fill this gap.

## What this means for phasing

Phase 0 is complete. The forensics above are the input to `MESH_ARCHITECTURE.md` and
`INTEGRATION_MATRIX.md`. Given the finding above, Phase 1 (contracts) is scoped as a genuinely new,
non-duplicated layer; Phases 5-9 (adapters) are scoped as *read* adapters against existing exported
data (snapshot or, for risk-replay only, live API) rather than new engines.
