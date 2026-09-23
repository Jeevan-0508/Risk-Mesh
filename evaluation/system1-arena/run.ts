/**
 * System-1 Arena orchestration (directive step 4): call every named model independently for the
 * same case and compare the real results. "Independently" is structural here, not a promise -
 * each `assessModelCall` is a separate call that never receives another model's result as input,
 * so there is no code path for one model to see another's answer even by accident.
 *
 * Needs at least 2 real (`ok:true`) results to be a genuine arena - if fewer come back, this
 * fails closed with the real reason for each failure rather than padding the comparison with a
 * fabricated stand-in result.
 */
import { assessModelCall } from '../../adapters/model-registry/adapter';
import type { CallModelDeps, ModelCallInput } from '../../adapters/model-registry/client';
import { compareModelResults, type ArenaComparison } from './compare';
import type { ModelResult } from '../../contracts/schemas';

export type ArenaRunResult =
  | { ok: true; results: ModelResult[]; comparison: ArenaComparison; failures: string[] }
  | { ok: false; reason: string; partialResults: ModelResult[]; failures: string[] };

export async function runSystem1Arena(
  modelIds: string[],
  input: ModelCallInput,
  deps?: CallModelDeps,
): Promise<ArenaRunResult> {
  if (modelIds.length < 2) {
    return {
      ok: false,
      reason: 'System-1 Arena needs at least 2 model_ids to compare independently - refusing to run an arena of one.',
      partialResults: [],
      failures: [],
    };
  }

  const results: ModelResult[] = [];
  const failures: string[] = [];

  for (const modelId of modelIds) {
    const assessment = await assessModelCall(modelId, input, deps);
    if (assessment.ok) {
      results.push(assessment.result);
    } else {
      failures.push(`${modelId}: ${assessment.reason}`);
    }
  }

  if (results.length < 2) {
    return {
      ok: false,
      reason: `only ${results.length} of ${modelIds.length} requested models produced a real result - the arena needs at least 2 to compare, and never fabricates a stand-in for the rest.`,
      partialResults: results,
      failures,
    };
  }

  const observedAt = deps?.now ? deps.now() : new Date().toISOString();
  const comparison = compareModelResults(results, { caseId: input.case_id ?? 'unscoped', observedAt });

  return { ok: true, results, comparison, failures };
}
