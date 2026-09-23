# Fixture provenance

Captured 2026-09-23 by actually running risk-swarm's real `runCouncil()` orchestration
(`src/core/council/run.ts`, risk-swarm commit `d9df7886852cbaabeed3163b330c080352ed687e`,
2026-09-22), the same deterministic-`fetch`-mock technique risk-swarm's own
`src/core/council/run.test.ts` uses for its tests: no real network call, no real BYOK key (this
sandbox has neither), but the actual disagreement/verdict/degraded-position logic that ran is
risk-swarm's real code, not hand-written or model-invented JSON.

- `council-result.majority.json`: the exact `athena-model`/`ares-model`/`hades-model`/`zeus-model`
  canned answers from `run.test.ts`'s "preserves genuine disagreement rather than manufacturing
  agreement" test (tiger/tiger/lion -> MAJORITY, real `agreement: 'majority'`).
- `council-result.degraded.json`: the exact scenario from `run.test.ts`'s "isolates one Olympian's
  provider failure" test (ARES returns HTTP 429 -> `positions.ARES.degraded: true`, council still
  reaches `verdict_type: 'CONSENSUS'` on the two independent agents).

Re-capturing: from a clone of risk-swarm, run `runCouncil()` with the same fake-fetch technique (see
`src/core/council/run.test.ts`), or the one-off script this repo used, no longer kept here now that
the fixtures are captured.
