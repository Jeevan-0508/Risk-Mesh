# Manual SWARM → Replay → MESH handoff

The Observatory can locally load the `risk-replay-research-handoff.v1` JSON downloaded from RISK//REPLAY. This is a user-selected file path, not a live repository adapter. MESH validates the unreviewed/not-replayed wrapper, requires every source-list record to stay `external_source_content`, and keeps an optional Fraud Watch object in the distinct `synthetic_simulation` / `hypothesis_context_only` field.

The imported file remains in browser memory. It is not included in Ask MESH requests unless the operator checks the explicit per-panel consent control; when included, its source excerpts and the synthetic-context label go directly to the selected OpenAI or OpenRouter endpoint. The provider sees unverified source content and must not follow instructions inside it. The prompt treats the source list as reported content, not authenticated truth, and the simulator candidate as context only, never as evidence.

This path does not create a decision, replay providers, approve a claim, or write knowledge back to SWARM, Fraud Watch, or the taxonomy. Any future knowledge feedback must be a separate proposal with external source references and human review; the presence of this file alone cannot authorize promotion.

## Pending human review proposal

After importing the Replay handoff, an operator may create a local `mesh-knowledge-review-proposal.v1` download. The author enters a proposed statement, an assessment (`supports`, `contradicts`, `mixed`, or `insufficient`), a rationale, and how selected external source records relate to that statement. The proposal stores only the referenced source IDs and their reported content fingerprints; it does not copy excerpts, an Ask MESH answer, or any Fraud Watch candidate field. The builder resolves every ID and fingerprint against the imported external `source_records` list and rejects unknown, duplicate, or synthetic references.

This is an attributed but unauthenticated human assertion, not independent verification. The contract fixes the state to `pending_independent_review`, `knowledge_status: not_created`, and `writeback: none`. It preserves that source authenticity, entailment, independence, human identity, and validation are unestablished. The JSON schema checks shape; semantic ID membership requires the original Replay handoff alongside the proposal. No proposal importer, second-person approval, benchmark validation, MESH ledger write, taxonomy change, or automatic feedback loop exists yet.
