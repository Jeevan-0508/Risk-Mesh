import test from "node:test";
import assert from "node:assert/strict";
import {
  createKnowledgeReviewProposal,
  validateKnowledgeReviewProposal,
} from "./knowledge-review-proposal.js";

const source = (evidenceId, overrides = {}) => ({
  evidence_id: evidenceId,
  data_class: "external_source_content",
  role: "retrieved_source_record",
  provider: "worldbank",
  source_identity: "World Bank",
  source_type: "statistical_body",
  query: "test query",
  url: "https://example.org/source",
  title: `Title ${evidenceId}`,
  excerpt: `DISTINCT_SOURCE_EXCERPT_SENTINEL_${evidenceId}`,
  content_hash: `hash-${evidenceId}`,
  content_hash_algorithm: "sha256",
  retrieved_at: "2026-09-29T11:59:00.000Z",
  stated_date: null,
  date_kind: "unknown",
  via_proxy: false,
  caveats: [],
  injection_suspected: false,
  ...overrides,
});

const handoff = (sourceRecords = [source("src-1"), source("src-2")]) => ({
  schema_version: "risk-replay-research-handoff.v1",
  kind: "risk_replay_research_handoff",
  created_at: "2026-09-29T12:00:00.000Z",
  review_state: "unreviewed",
  replay_status: "not_replayed",
  capture: {
    source: { repository: "Jeevan-0508/risk-swarm", revision: "a".repeat(40) },
    research: { run_id: "run-42", source_records: sourceRecords },
    hypothesis_context: {
      data_class: "synthetic_simulation",
      role: "hypothesis_context_only",
      candidate: { candidate: { id: "candidate-sim-1" } },
    },
  },
});

const input = (overrides = {}) => ({
  created_at: "2026-09-29T12:30:00.000Z",
  author_name: "Jeevan",
  statement: "A proposed claim based on the cited external records.",
  assessment: "supports",
  rationale: "The source excerpt appears relevant, but its truth and entailment are not independently verified.",
  evidence_references: [{ evidence_id: "src-1", relationship: "supports" }],
  ...overrides,
});

test("builds a pending proposal with only source IDs, never simulator candidate data", () => {
  const result = createKnowledgeReviewProposal(handoff(), input());
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.proposal.status, "pending_independent_review");
  assert.equal(result.proposal.knowledge_status, "not_created");
  assert.equal(result.proposal.writeback, "none");
  assert.equal(result.proposal.synthetic_hypothesis, "excluded");
  assert.deepEqual(result.proposal.proposal.evidence_references, [{
    evidence_id: "src-1",
    relationship: "supports",
    content_hash: "hash-src-1",
    content_hash_algorithm: "sha256",
  }]);
  assert.equal(JSON.stringify(result.proposal).includes("candidate-sim-1"), false);
  assert.equal(JSON.stringify(result.proposal).includes("DISTINCT_SOURCE_EXCERPT_SENTINEL"), false);
  assert.equal(validateKnowledgeReviewProposal(result.proposal, handoff()).ok, true);
});

test("accepts mixed support and contradiction only when both are separately sourced", () => {
  const result = createKnowledgeReviewProposal(handoff(), input({
    assessment: "mixed",
    evidence_references: [
      { evidence_id: "src-1", relationship: "supports" },
      { evidence_id: "src-2", relationship: "contradicts" },
    ],
  }));
  assert.equal(result.ok, true);
});

test("allows an insufficient assessment with context-only or no references", () => {
  for (const evidence_references of [[], [{ evidence_id: "src-1", relationship: "context_only" }]]) {
    assert.equal(createKnowledgeReviewProposal(handoff(), input({ assessment: "insufficient", evidence_references })).ok, true);
  }
});

test("rejects synthetic IDs, duplicate references, and an inconsistent assessment", () => {
  assert.equal(createKnowledgeReviewProposal(handoff(), input({ evidence_references: [{ evidence_id: "candidate-sim-1", relationship: "supports" }] })).ok, false);
  assert.equal(createKnowledgeReviewProposal(handoff(), input({ evidence_references: [
    { evidence_id: "src-1", relationship: "supports" },
    { evidence_id: "src-1", relationship: "supports" },
  ] })).ok, false);
  assert.equal(createKnowledgeReviewProposal(handoff(), input({ assessment: "mixed" })).ok, false);
});

test("rejects synthetic or malformed records in the source-record list", () => {
  const mixedSourceList = handoff([
    source("src-1"),
    source("candidate-sim-1", { data_class: "synthetic_simulation", role: "hypothesis_context_only" }),
  ]);
  assert.equal(createKnowledgeReviewProposal(mixedSourceList, input()).ok, false);
});

test("rejects altered workflow states, missing handoff context, and extra promotion fields", () => {
  const made = createKnowledgeReviewProposal(handoff(), input());
  assert.equal(made.ok, true);
  if (!made.ok) return;

  assert.equal(validateKnowledgeReviewProposal(made.proposal, undefined).ok, false);
  assert.equal(validateKnowledgeReviewProposal({ ...made.proposal, knowledge_status: "VALIDATED" }, handoff()).ok, false);
  assert.equal(validateKnowledgeReviewProposal({ ...made.proposal, adopted: true }, handoff()).ok, false);
});

test("requires the source capture to remain unreviewed and not replayed", () => {
  const reviewed = handoff();
  reviewed.review_state = "reviewed";
  assert.equal(createKnowledgeReviewProposal(reviewed, input()).ok, false);
});
