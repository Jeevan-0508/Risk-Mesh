/**
 * Entry point a Model Arena caller would use once one exists (§10-11): list the registry, or ask a
 * model to produce a result for a case. Composes registry.ts + client.ts; since client.ts never
 * succeeds today, this never returns a `ModelResult` either — only `getModelRegistry()` returns
 * real data (the registry itself, honestly labeled NOT_CONNECTED).
 */
import { callModel } from './client';
import { getModelRegistry } from './registry';
import type { ModelProfile } from '../../contracts/schemas';

export { getModelRegistry };

export type ModelAssessment =
  | { ok: false; reason: string };

export async function assessModelCall(modelId: string, input: Record<string, unknown>): Promise<ModelAssessment> {
  const result = await callModel(modelId, input);
  return { ok: false, reason: `${result.status}: ${result.reason}` };
}

export function registryStatusSummary(): { model_id: string; status: ModelProfile['status'] }[] {
  return getModelRegistry().map((m) => ({ model_id: m.model_id ?? m.id, status: m.status }));
}
