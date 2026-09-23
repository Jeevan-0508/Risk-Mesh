/**
 * Entry point a Model Arena caller would use once one exists (§10-11): list the registry, or ask a
 * model to produce a result for a case. Composes registry.ts + client.ts; `laya-typed` is the one
 * model_id that can honestly return `ok:true` with a real `ModelResult` (System-1 directive Step
 * 2) - every other id still fails closed exactly as before.
 */
import { callModel, type CallModelDeps, type ModelCallInput } from './client';
import { getModelRegistry } from './registry';
import type { ModelProfile, ModelResult } from '../../contracts/schemas';

export { getModelRegistry };

export type ModelAssessment =
  | { ok: true; result: ModelResult }
  | { ok: false; reason: string };

export async function assessModelCall(modelId: string, input: ModelCallInput, deps?: CallModelDeps): Promise<ModelAssessment> {
  const result = await callModel(modelId, input, deps);
  if (result.ok) {
    return { ok: true, result: result.result };
  }
  return { ok: false, reason: `${result.status}: ${result.reason}` };
}

export function registryStatusSummary(): { model_id: string; status: ModelProfile['status'] }[] {
  return getModelRegistry().map((m) => ({ model_id: m.model_id ?? m.id, status: m.status }));
}
