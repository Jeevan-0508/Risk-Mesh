import { z } from 'zod';

export const MeshUpdateStatus = z.enum(['NEW', 'UPDATED', 'SEEN', 'UNCHANGED', 'UNAVAILABLE']);
export const MeshUpdateImportance = z.enum(['high', 'medium', 'low']);

const MeshLink = z.object({
  label: z.string().min(1),
  url: z.string().url(),
});

/**
 * The small cross-project briefing contract. It describes an observed source
 * change; it is deliberately not a Decision, Evidence, or model result.
 */
export const MeshUpdate = z.object({
  id: z.string().min(1),
  sourceProject: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }),
  title: z.string().min(1),
  summary: z.string().min(1),
  category: z.string().min(1),
  importance: MeshUpdateImportance,
  evidenceType: z.string().min(1),
  sourceType: z.string().min(1),
  links: z.array(MeshLink),
  provenance: z.record(z.unknown()),
  details: z.record(z.unknown()),
  status: MeshUpdateStatus,
  fingerprint: z.string().min(1),
});

export type MeshUpdate = z.infer<typeof MeshUpdate>;
