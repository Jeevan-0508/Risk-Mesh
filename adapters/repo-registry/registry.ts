/**
 * The Knowledge Fabric's repository registry (Ask MESH directive, 2026-09-23). Declares, for each
 * repository in Jeevan's risk ecosystem MESH could plausibly draw on, whether MESH actually reads
 * it today and how - so Ask MESH (and any future query router/retrieval layer built on top of this)
 * can answer "what does MESH know about X" honestly instead of assuming a connection that does not
 * exist. Extends the existing registry pattern from adapters/model-registry/registry.ts (a plain,
 * hand-authored array of real entries, not a database) rather than duplicating a second one.
 *
 * Every entry here is grounded in this session's own read of the actual repository and the actual
 * adapters/ directory - none of it is aspirational. Where MESH has no adapter for a repository yet,
 * that is stated as UNAVAILABLE with capabilities: [], not silently omitted or guessed at.
 *
 * Repositories NOT included: gdpr-compliance-scanner does not exist as a local checkout this
 * session could read, so per the directive ("only include repositories that actually exist and can
 * be read safely") it is left out entirely rather than declared with fabricated facts.
 */
import type { RepositorySource } from "../../contracts/schemas";

const AT = "2026-09-23T00:00:00.000Z";

function unavailable(args: {
  repository_id: string;
  name: string;
  purpose: string;
  domain: string;
  repo_url: string | null;
  why: string;
}): RepositorySource {
  return {
    id: "repo-" + args.repository_id,
    schema_version: "1.0",
    created_at: AT,
    source: "repo-registry",
    provenance: {
      source: "UNAVAILABLE",
      system: args.repository_id,
      retrieved_at: AT,
      upstream_ref: null,
      note: args.why,
    },
    status: "UNAVAILABLE",
    repository_id: args.repository_id,
    name: args.name,
    purpose: args.purpose,
    domain: args.domain,
    capabilities: [],
    source_type: "not-integrated",
    snapshot_path: null,
    snapshot_hash: null,
    version: null,
    captured_at: null,
    trust_status: "UNAVAILABLE",
    repo_url: args.repo_url,
  };
}

/**
 * The real risk-swarm sync timestamp and hashes below come from
 * risk-swarm/public/snapshots/provenance.json as it exists on disk this session - not invented, not
 * re-hashed independently (adapters/_shared/snapshot-provenance.ts is what actually verifies these
 * hashes at read time; this registry only records what that file already says).
 */
const SNAPSHOT_SYNCED_AT = "2026-09-12T19:09:48.281Z";

export const REPOSITORY_REGISTRY: RepositorySource[] = [
  {
    id: "repo-fraud-watch",
    schema_version: "1.0",
    created_at: AT,
    source: "repo-registry",
    provenance: {
      source: "SIMULATED",
      system: "fraud-watch",
      retrieved_at: AT,
      upstream_ref: null,
      note: "adapters/fraud-watch reads fraud-watch's own world-state.mos.json live off disk at query time; the MO records themselves are fraud-watch's SIMULATED game data, never real fraud.",
    },
    status: "LIVE",
    repository_id: "fraud-watch",
    name: "fraud-watch",
    purpose: "Freight-fraud investigation arcade game: a deterministic simulation of carriers, lanes and MO (modus operandi) patterns, played by a human or a BYOK AI council.",
    domain: "fraud",
    capabilities: ["read the current simulated MO records (VALIDATED_MO-shaped) from a real world-state.mos.json file, mapped to a MESH Behavior"],
    source_type: "file-read",
    snapshot_path: null,
    snapshot_hash: null,
    version: null,
    captured_at: null,
    trust_status: "SIMULATED",
    repo_url: "https://github.com/Jeevan-0508/fraud-watch",
  },
  {
    id: "repo-risk-swarm",
    schema_version: "1.0",
    created_at: AT,
    source: "repo-registry",
    provenance: {
      source: "UNAVAILABLE",
      system: "risk-swarm",
      retrieved_at: AT,
      upstream_ref: null,
      note: "adapters/risk-swarm has no client.ts: it only translates a CouncilResult the caller already has (per its own top-of-file comment). Ask MESH has no CouncilResult to hand it today, so this adapter cannot answer anything on its own yet.",
    },
    status: "UNAVAILABLE",
    repository_id: "risk-swarm",
    name: "risk-swarm",
    purpose: "OLYMPIAN COUNCIL: a multi-model BYOK council (ZEUS/ATHENA/ARES/HADES) that debates a question and reports agreement/disagreement.",
    domain: "multi-model-reasoning",
    capabilities: ["translate an existing real CouncilResult into MESH ModelResult/Disagreement records, if one is supplied - cannot fetch or run a council of its own"],
    source_type: "translation-only",
    snapshot_path: null,
    snapshot_hash: null,
    version: null,
    captured_at: null,
    trust_status: "UNAVAILABLE",
    repo_url: "https://github.com/Jeevan-0508/risk-swarm",
  },
  {
    id: "repo-risk-replay",
    schema_version: "1.0",
    created_at: AT,
    source: "repo-registry",
    provenance: {
      source: "UNAVAILABLE",
      system: "risk-replay",
      retrieved_at: AT,
      upstream_ref: null,
      note: "adapters/risk-replay/client.ts is a real HTTP client for risk-replay's FastAPI backend, live-verified against it in an earlier session - but that backend is not running anywhere Ask MESH's static, browser-only page can reach. UNAVAILABLE here describes today's deployed reality, not the adapter's own code.",
    },
    status: "UNAVAILABLE",
    repository_id: "risk-replay",
    name: "risk-replay",
    purpose: "Counterfactual replay engine: re-runs a past decision under a changed input and reports how the outcome would have differed.",
    domain: "replay",
    capabilities: ["real HTTP client exists and is live-verified against a running backend - needs that backend reachable from wherever MESH runs, which is not true for the static Observatory page today"],
    source_type: "http-client",
    snapshot_path: null,
    snapshot_hash: null,
    version: null,
    captured_at: null,
    trust_status: "UNAVAILABLE",
    repo_url: "https://github.com/Jeevan-0508/risk-replay",
  },
  {
    id: "repo-freight-risk-atlas",
    schema_version: "1.0",
    created_at: AT,
    source: "repo-registry",
    provenance: {
      source: "SNAPSHOT",
      system: "freight-risk-atlas",
      retrieved_at: AT,
      upstream_ref: "fc1a66dc387bdd410eeaaf55220882097eeaef0b",
      note: "adapters/freight-risk-atlas reads a hash-verified snapshot of taxonomy.json synced and hashed by risk-swarm's own scripts/sync-snapshots.mjs, not risk-mesh's. Accurate as of the sync below, not freight-risk-atlas's current HEAD.",
    },
    status: "SNAPSHOT",
    repository_id: "freight-risk-atlas",
    name: "freight-risk-atlas",
    purpose: "Freight & Carrier Fraud Risk Taxonomy model as synced into the Atlas: patterns, indicators, false positives, countermeasures, regulatory hooks.",
    domain: "fraud-taxonomy",
    capabilities: ["read TAXONOMY_PATTERN-shaped records (patterns, indicators, countermeasures) from a hash-verified snapshot"],
    source_type: "snapshot-file",
    snapshot_path: "freight-risk-atlas/taxonomy.json",
    snapshot_hash: "bd31aafa361deea478d54508bf776589646a63442e724f7d5b09b72e626aa456",
    version: "fc1a66dc387bdd410eeaaf55220882097eeaef0b",
    captured_at: SNAPSHOT_SYNCED_AT,
    trust_status: "SNAPSHOT",
    repo_url: "https://github.com/Jeevan-0508/freight-risk-atlas",
  },
  {
    id: "repo-fomo",
    schema_version: "1.0",
    created_at: AT,
    source: "repo-registry",
    provenance: {
      source: "SNAPSHOT",
      system: "FOMO",
      retrieved_at: AT,
      upstream_ref: "451c5c989df259553e0acc9f041dea274e929857",
      note: "adapters/fomo reads a hash-verified snapshot of signals.json synced and hashed by risk-swarm's own scripts/sync-snapshots.mjs. Accurate as of the sync below, not FOMO's current HEAD.",
    },
    status: "SNAPSHOT",
    repository_id: "FOMO",
    name: "FOMO",
    purpose: "External freight/logistics risk signal scanner over Google News RSS.",
    domain: "external-signals",
    capabilities: ["read RISK_SIGNAL-shaped records from a hash-verified snapshot of discovered news signals"],
    source_type: "snapshot-file",
    snapshot_path: "fomo/signals.json",
    snapshot_hash: "73087903d9fe46d8db680766c62901f8f908c0d2b411ea98ba21999f54ee7ec2",
    version: "451c5c989df259553e0acc9f041dea274e929857",
    captured_at: SNAPSHOT_SYNCED_AT,
    trust_status: "SNAPSHOT",
    repo_url: "https://github.com/Jeevan-0508/FOMO",
  },
  unavailable({
    repository_id: "freight-fraud-taxonomy",
    name: "freight-fraud-taxonomy",
    purpose: "An open, structured taxonomy of fraud and cargo-loss patterns in European road freight.",
    domain: "fraud-taxonomy",
    repo_url: "https://github.com/Jeevan-0508/freight-fraud-taxonomy",
    why: "Repository exists locally but no adapters/ directory reads it. Note: freight-risk-atlas's taxonomy.json snapshot above is a related but distinct downstream artifact, not this repository's own source files.",
  }),
  unavailable({
    repository_id: "policy-audit",
    name: "policy-audit",
    purpose: "AI governance evidence auditor: finds the gap between what a governance policy says and what the audit evidence actually shows, across the EU AI Act, ISO/IEC 42001 and the NIST AI RMF.",
    domain: "ai-governance",
    repo_url: "https://github.com/Jeevan-0508/policy-audit",
    why: "No adapters/ directory reads it. risk-swarm's own provenance.json already has a real hash-verified sync of a related repository, ai-governance-control-room (frameworks.json + controls.json, synced " + SNAPSHOT_SYNCED_AT + ") - genuinely connectable data MESH does not read yet, and the strongest candidate for the next real adapter, but its content has not been verified this session as the same thing as policy-audit's current repo, so it is not claimed here.",
  }),
  unavailable({
    repository_id: "eu-ai-act-scanner",
    name: "eu-ai-act-scanner",
    purpose: "Browser-only compliance scanner scoring a system against the EU AI Act, ISO/IEC 42001 and NIST AI RMF.",
    domain: "ai-governance",
    repo_url: "https://github.com/Jeevan-0508/eu-ai-act-scanner",
    why: "Repository exists locally but no adapters/ directory reads it.",
  }),
  unavailable({
    repository_id: "ruleshift",
    name: "ruleshift",
    purpose: "A puzzle game about rules that quietly change: contact-based effect propagation and parity-based world flips.",
    domain: "game",
    repo_url: "https://github.com/Jeevan-0508/ruleshift",
    why: "Repository exists locally but no adapters/ directory reads it, and it has no fraud/risk domain data MESH would have a reason to retrieve.",
  }),
  unavailable({
    repository_id: "risk-ring",
    name: "risk-ring",
    purpose: "Financial-crime network intelligence: a trained fraud classifier with honest metrics, SHAP explainability, and graph-based collusion-ring detection.",
    domain: "fraud",
    repo_url: "https://github.com/Jeevan-0508/risk-ring",
    why: "Repository exists locally but no adapters/ directory reads it.",
  }),
];

export function getRepositorySource(repository_id: string): RepositorySource | null {
  return REPOSITORY_REGISTRY.find((r) => r.repository_id === repository_id) ?? null;
}

export function listConnectedRepositorySources(): RepositorySource[] {
  return REPOSITORY_REGISTRY.filter((r) => r.status !== "UNAVAILABLE");
}
