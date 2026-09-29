const SCHEMA_VERSION = "mesh-knowledge-review-proposal.v1";
const ASSESSMENTS = ["supports", "contradicts", "mixed", "insufficient"];
const RELATIONSHIPS = ["supports", "contradicts", "context_only"];
const SOURCE_RECORD_KEYS = [
  "evidence_id", "data_class", "role", "provider", "source_identity", "source_type", "query", "url",
  "title", "excerpt", "content_hash", "content_hash_algorithm", "retrieved_at", "stated_date", "date_kind",
  "via_proxy", "caveats", "injection_suspected",
];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function getExternalSourceRecords(handoff) {
  const research = handoff?.capture?.research;
  if (
    handoff?.schema_version !== "risk-replay-research-handoff.v1" ||
    handoff?.review_state !== "unreviewed" ||
    handoff?.replay_status !== "not_replayed" ||
    typeof handoff.created_at !== "string" || Number.isNaN(Date.parse(handoff.created_at)) ||
    handoff?.capture?.source?.repository !== "Jeevan-0508/risk-swarm" ||
    !(handoff?.capture?.source?.revision === null || /^[0-9a-f]{40}$/.test(handoff?.capture?.source?.revision)) ||
    typeof research?.run_id !== "string" ||
    !Array.isArray(research?.source_records)
  ) return null;

  const ids = new Set();
  for (const source of research.source_records) {
    if (
      !exactKeys(source, SOURCE_RECORD_KEYS) ||
      source.data_class !== "external_source_content" ||
      source.role !== "retrieved_source_record" ||
      typeof source.evidence_id !== "string" ||
      ids.has(source.evidence_id) ||
      typeof source.content_hash !== "string" ||
      !["sha256", "fnv1a"].includes(source.content_hash_algorithm)
    ) return null;
    ids.add(source.evidence_id);
  }
  return research.source_records;
}

function validateProposal(value, handoff) {
  const sourceRecords = getExternalSourceRecords(handoff);
  if (!sourceRecords) return { ok: false, error: "A valid, still-unreviewed Risk Replay handoff is required to resolve source IDs." };
  if (!exactKeys(value, [
    "schema_version", "kind", "created_at", "status", "knowledge_status", "writeback",
    "human_authorship", "source_capture", "proposal", "synthetic_hypothesis", "epistemic_limits",
  ])) return { ok: false, error: "Proposal fields do not match the strict v1 contract." };
  if (
    value.schema_version !== SCHEMA_VERSION ||
    value.kind !== "mesh_knowledge_review_proposal" ||
    typeof value.created_at !== "string" || Number.isNaN(Date.parse(value.created_at)) ||
    value.status !== "pending_independent_review" ||
    value.knowledge_status !== "not_created" ||
    value.writeback !== "none" ||
    value.synthetic_hypothesis !== "excluded"
  ) return { ok: false, error: "Proposal version or fixed non-promotion state is invalid." };

  if (!exactKeys(value.human_authorship, ["display_name", "identity_basis"]) ||
      typeof value.human_authorship.display_name !== "string" ||
      value.human_authorship.display_name.trim().length < 1 ||
      value.human_authorship.identity_basis !== "self_declared_unverified") {
    return { ok: false, error: "Human attribution must be present and explicitly unverified." };
  }

  if (!exactKeys(value.source_capture, ["handoff_schema_version", "handoff_created_at", "swarm_repository", "swarm_revision", "swarm_run_id"]) ||
      value.source_capture.handoff_schema_version !== handoff.schema_version ||
      value.source_capture.handoff_created_at !== handoff.created_at ||
      value.source_capture.swarm_repository !== handoff.capture.source.repository ||
      value.source_capture.swarm_revision !== handoff.capture.source.revision ||
      value.source_capture.swarm_run_id !== handoff.capture.research.run_id) {
    return { ok: false, error: "Proposal provenance does not match the imported handoff." };
  }

  const proposal = value.proposal;
  if (!exactKeys(proposal, ["statement", "assessment", "rationale", "evidence_references"]) ||
      typeof proposal.statement !== "string" || proposal.statement.trim().length < 12 || proposal.statement.length > 1000 ||
      !ASSESSMENTS.includes(proposal.assessment) ||
      typeof proposal.rationale !== "string" || proposal.rationale.trim().length < 12 || proposal.rationale.length > 3000 ||
      !Array.isArray(proposal.evidence_references)) {
    return { ok: false, error: "Proposal statement, assessment, rationale, or references are invalid." };
  }

  const sourcesById = new Map(sourceRecords.map((source) => [source.evidence_id, source]));
  const referencedIds = new Set();
  const counts = { supports: 0, contradicts: 0, context_only: 0 };
  for (const reference of proposal.evidence_references) {
    if (!exactKeys(reference, ["evidence_id", "relationship", "content_hash", "content_hash_algorithm"]) ||
        !RELATIONSHIPS.includes(reference.relationship) ||
        referencedIds.has(reference.evidence_id)) {
      return { ok: false, error: "Evidence references must be unique, typed external source-record IDs." };
    }
    const source = sourcesById.get(reference.evidence_id);
    if (!source || reference.content_hash !== source.content_hash || reference.content_hash_algorithm !== source.content_hash_algorithm) {
      return { ok: false, error: "An evidence reference does not resolve to an external source record in this handoff." };
    }
    referencedIds.add(reference.evidence_id);
    counts[reference.relationship] += 1;
  }

  const assessmentMatches = {
    supports: counts.supports > 0 && counts.contradicts === 0,
    contradicts: counts.contradicts > 0 && counts.supports === 0,
    mixed: counts.supports > 0 && counts.contradicts > 0,
    insufficient: counts.supports === 0 && counts.contradicts === 0,
  };
  if (!assessmentMatches[proposal.assessment]) return { ok: false, error: "Assessment does not match the selected source-reference relationships." };

  if (!exactKeys(value.epistemic_limits, ["source_authenticity", "claim_entailment", "source_independence", "human_identity", "validation"]) ||
      value.epistemic_limits.source_authenticity !== "unverified" ||
      value.epistemic_limits.claim_entailment !== "not_established" ||
      value.epistemic_limits.source_independence !== "not_established" ||
      value.epistemic_limits.human_identity !== "not_verified" ||
      value.epistemic_limits.validation !== "not_performed") {
    return { ok: false, error: "Proposal must preserve every epistemic limitation." };
  }
  return { ok: true, proposal: value };
}

/** Build a local, human-authored proposal. This never creates or validates MESH knowledge. */
export function createKnowledgeReviewProposal(handoff, input) {
  if (!isRecord(input)) return { ok: false, error: "Review input is required." };
  if (Array.isArray(input.evidence_references) && !input.evidence_references.every((reference) =>
    isRecord(reference) && typeof reference.evidence_id === "string" && typeof reference.relationship === "string")) {
    return { ok: false, error: "Each selected reference needs a source-record ID and relationship." };
  }
  const proposal = {
    schema_version: SCHEMA_VERSION,
    kind: "mesh_knowledge_review_proposal",
    created_at: input.created_at,
    status: "pending_independent_review",
    knowledge_status: "not_created",
    writeback: "none",
    human_authorship: {
      display_name: typeof input.author_name === "string" ? input.author_name.trim() : "",
      identity_basis: "self_declared_unverified",
    },
    source_capture: {
      handoff_schema_version: handoff?.schema_version,
      handoff_created_at: handoff?.created_at,
      swarm_repository: handoff?.capture?.source?.repository,
      swarm_revision: handoff?.capture?.source?.revision,
      swarm_run_id: handoff?.capture?.research?.run_id,
    },
    proposal: {
      statement: input.statement,
      assessment: input.assessment,
      rationale: input.rationale,
      evidence_references: Array.isArray(input.evidence_references)
        ? input.evidence_references.map((reference) => {
          const source = handoff?.capture?.research?.source_records?.find((item) => item.evidence_id === reference.evidence_id);
          return {
            evidence_id: reference.evidence_id,
            relationship: reference.relationship,
            content_hash: source?.content_hash,
            content_hash_algorithm: source?.content_hash_algorithm,
          };
        })
        : input.evidence_references,
    },
    synthetic_hypothesis: "excluded",
    epistemic_limits: {
      source_authenticity: "unverified",
      claim_entailment: "not_established",
      source_independence: "not_established",
      human_identity: "not_verified",
      validation: "not_performed",
    },
  };
  return validateProposal(proposal, handoff);
}

/** Semantic validation requires the original Replay handoff so IDs cannot be treated as evidence by shape alone. */
export function validateKnowledgeReviewProposal(value, handoff) {
  return validateProposal(value, handoff);
}
