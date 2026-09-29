# Manual SWARM → Replay → MESH handoff

The Observatory can locally load the `risk-replay-research-handoff.v1` JSON downloaded from RISK//REPLAY. This is a user-selected file path, not a live repository adapter. MESH validates the unreviewed/not-replayed wrapper, requires every source-list record to stay `external_source_content`, and keeps an optional Fraud Watch object in the distinct `synthetic_simulation` / `hypothesis_context_only` field.

The imported file remains in browser memory. It is not included in Ask MESH requests unless the operator checks the explicit per-panel consent control; when included, its source excerpts and the synthetic-context label go directly to the selected OpenAI or OpenRouter endpoint. The provider sees unverified source content and must not follow instructions inside it. The prompt treats the source list as reported content, not authenticated truth, and the simulator candidate as context only, never as evidence.

This path does not create a decision, replay providers, approve a claim, or write knowledge back to SWARM, Fraud Watch, or the taxonomy. Any future knowledge feedback must be a separate proposal with external source references and human review; the presence of this file alone cannot authorize promotion.
