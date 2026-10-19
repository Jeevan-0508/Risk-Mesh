import { PolicyAuditBundle, type PolicyAuditBundle as PolicyAuditBundleType } from '../../contracts/policy-audit';
import type { OlympusScenario } from '../../core/olympus-pipeline';

export interface PolicyAuditIntake {
  scenario: OlympusScenario;
  sourceFindingIds: string[];
  frameworkIds: string[];
}

/**
 * Translate the POLICY//AUDIT export shape into the deterministic Olympus intake shape.
 * This is a field-level adapter; it does not import POLICY//AUDIT's UI or silently promote
 * LLM-assisted assessments to MESH evidence.
 */
export function policyAuditBundleToOlympusScenario(input: unknown, reviewer: string): PolicyAuditIntake {
  const bundle: PolicyAuditBundleType = PolicyAuditBundle.parse(input);
  const scenario: OlympusScenario = {
    id: bundle.run_id,
    aiSystem: bundle.system,
    now: bundle.created_at,
    reviewer,
    documents: bundle.documents.map((document) => ({
      id: document.id,
      name: document.filename,
      content: document.content,
      sourceType: `policy-audit:${document.source_ref}`,
    })),
  };
  return { scenario, sourceFindingIds: bundle.findings.map((finding) => finding.id), frameworkIds: bundle.framework_ids };
}

export function validatePolicyAuditBundle(input: unknown): input is PolicyAuditBundleType {
  return PolicyAuditBundle.safeParse(input).success;
}

