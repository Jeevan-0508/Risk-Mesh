import { z } from 'zod';

/**
 * Boundary contract for POLICY//AUDIT -> RISK//MESH intake.
 *
 * The contract intentionally contains source references and method labels. A finding without
 * those fields is not accepted at the integration boundary, and a missing/partial assessment
 * remains distinct from a confirmed legal conclusion.
 */
export const PolicyAuditDocument = z.object({
  id: z.string().min(1),
  filename: z.string().min(1),
  content: z.string().min(1),
  content_hash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  source_ref: z.string().min(1),
});
export type PolicyAuditDocument = z.infer<typeof PolicyAuditDocument>;

export const PolicyAuditEvidence = z.object({
  id: z.string().min(1),
  document_id: z.string().min(1),
  source_ref: z.string().min(1),
  statement: z.string().min(1),
  classification_method: z.enum(['deterministic', 'llm-assisted']),
  status: z.enum(['SUPPORTED', 'PARTIAL', 'MISSING', 'CONFLICT']),
});
export type PolicyAuditEvidence = z.infer<typeof PolicyAuditEvidence>;

export const PolicyAuditFinding = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL']),
  status: z.enum(['SUPPORTED', 'PARTIAL', 'MISSING']),
  requirement_ids: z.array(z.string().min(1)).min(1),
  evidence_ids: z.array(z.string().min(1)),
  reasoning: z.string().min(1),
  uncertainty: z.string().min(1),
});
export type PolicyAuditFinding = z.infer<typeof PolicyAuditFinding>;

export const PolicyAuditBundle = z.object({
  schema_version: z.string().min(1),
  run_id: z.string().min(1),
  created_at: z.string().datetime({ offset: true }),
  system: z.object({ id: z.string().min(1), name: z.string().min(1), purpose: z.string().min(1), impact: z.enum(['STANDARD', 'HIGH']) }),
  documents: z.array(PolicyAuditDocument).min(1),
  evidence: z.array(PolicyAuditEvidence),
  findings: z.array(PolicyAuditFinding),
  framework_ids: z.array(z.string().min(1)).min(1),
});
export type PolicyAuditBundle = z.infer<typeof PolicyAuditBundle>;

