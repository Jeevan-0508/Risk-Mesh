import { describe, expect, it } from "bun:test";
import { validateMeshObject } from "../../contracts";
import { REPOSITORY_REGISTRY, getRepositorySource, listConnectedRepositorySources } from "./registry";

describe("REPOSITORY_REGISTRY", () => {
  it("has exactly the 10 repositories the Ask MESH directive named that actually exist locally (gdpr-compliance-scanner excluded, it does not)", () => {
    expect(REPOSITORY_REGISTRY.map((r) => r.repository_id)).toEqual([
      "fraud-watch", "risk-swarm", "risk-replay", "freight-risk-atlas", "FOMO",
      "freight-fraud-taxonomy", "policy-audit", "eu-ai-act-scanner", "ruleshift", "risk-ring",
    ]);
  });

  it("every entry validates against the RepositorySource contract", () => {
    for (const entry of REPOSITORY_REGISTRY) {
      const result = validateMeshObject("repository-source", entry);
      expect(result.ok).toBe(true);
    }
  });

  it("never claims LIVE or SNAPSHOT without a real adapter behind it - only fraud-watch (LIVE) and freight-risk-atlas/FOMO (SNAPSHOT) are non-UNAVAILABLE today", () => {
    const connected = listConnectedRepositorySources().map((r) => r.repository_id);
    expect(connected.sort()).toEqual(["FOMO", "fraud-watch", "freight-risk-atlas"].sort());
  });

  it("every UNAVAILABLE entry has a UNAVAILABLE trust_status - never a fabricated trust label for a repo MESH cannot actually read", () => {
    for (const entry of REPOSITORY_REGISTRY) {
      if (entry.status !== "UNAVAILABLE") continue;
      expect(entry.trust_status).toBe("UNAVAILABLE");
    }
  });

  it("every not-integrated entry (no adapter at all) has an empty capabilities list - never a fabricated capability for a repo MESH never even wrote a reader for", () => {
    for (const entry of REPOSITORY_REGISTRY) {
      if (entry.source_type !== "not-integrated") continue;
      expect(entry.capabilities).toEqual([]);
    }
  });

  it("risk-swarm and risk-replay are UNAVAILABLE but still honestly describe the real adapter capability they DO have, unlike the not-integrated repos", () => {
    for (const id of ["risk-swarm", "risk-replay"]) {
      const entry = getRepositorySource(id);
      expect(entry?.status).toBe("UNAVAILABLE");
      expect(entry?.capabilities.length).toBeGreaterThan(0);
    }
  });

  it("the two SNAPSHOT entries (freight-risk-atlas, FOMO) carry a real snapshot_hash, version and captured_at - never null for a status that claims a snapshot exists", () => {
    for (const id of ["freight-risk-atlas", "FOMO"]) {
      const entry = getRepositorySource(id);
      expect(entry?.status).toBe("SNAPSHOT");
      expect(entry?.snapshot_hash).toBeTruthy();
      expect(entry?.version).toBeTruthy();
      expect(entry?.captured_at).toBeTruthy();
    }
  });

  it("risk-swarm is honestly UNAVAILABLE despite having a real adapter, because that adapter has no client of its own", () => {
    const riskSwarm = getRepositorySource("risk-swarm");
    expect(riskSwarm?.status).toBe("UNAVAILABLE");
    expect(riskSwarm?.source_type).toBe("translation-only");
  });

  it("risk-replay is honestly UNAVAILABLE for the deployed static Observatory despite having a real, live-verified HTTP client", () => {
    const riskReplay = getRepositorySource("risk-replay");
    expect(riskReplay?.status).toBe("UNAVAILABLE");
    expect(riskReplay?.source_type).toBe("http-client");
  });

  it("getRepositorySource returns null for an unknown id rather than throwing or guessing", () => {
    expect(getRepositorySource("does-not-exist")).toBeNull();
  });
});
