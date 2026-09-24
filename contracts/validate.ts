/**
 * A single dispatch point so adapters validate against the same registry the tests do, instead of
 * each adapter importing whichever schema it assumes is right.
 */
import { z } from 'zod';
import * as schemas from './schemas';

export const MESH_OBJECT_KINDS = [
  'case', 'evidence', 'signal', 'behavior', 'decision', 'model-result', 'disagreement',
  'challenge', 'replay', 'candidate-mo', 'outcome', 'lesson', 'knowledge', 'review',
  'trust', 'experiment', 'model-profile', 'repository-source',
] as const;
export type MeshObjectKind = typeof MESH_OBJECT_KINDS[number];

const SCHEMA_OF_KIND: Record<MeshObjectKind, z.ZodTypeAny> = {
  case: schemas.Case,
  evidence: schemas.Evidence,
  signal: schemas.Signal,
  behavior: schemas.Behavior,
  decision: schemas.Decision,
  'model-result': schemas.ModelResult,
  disagreement: schemas.Disagreement,
  challenge: schemas.Challenge,
  replay: schemas.Replay,
  'candidate-mo': schemas.CandidateMo,
  outcome: schemas.Outcome,
  lesson: schemas.Lesson,
  knowledge: schemas.Knowledge,
  review: schemas.Review,
  trust: schemas.Trust,
  experiment: schemas.Experiment,
  'model-profile': schemas.ModelProfile,
  'repository-source': schemas.RepositorySource,
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

export function validateMeshObject<K extends MeshObjectKind>(kind: K, candidate: unknown): ValidationResult<unknown> {
  const schema = SCHEMA_OF_KIND[kind];
  const result = schema.safeParse(candidate);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, errors: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
}
