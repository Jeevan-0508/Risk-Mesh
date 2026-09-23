/**
 * Every call here fails closed. There is no code path in this file that returns a `ModelResult` —
 * per §9/§10 ("never fabricate Jev results, never simulate and present as live") and the Phase 0
 * audit's finding that no repo in this ecosystem has ever integrated Laya or Jev, a genuine call
 * cannot honestly be made yet. This exists so the *shape* callModel() will have is agreed now,
 * before any credentials/runtime do.
 */
import { findModelProfile } from './registry';

export type ModelCallResult =
  | { ok: false; status: 'NOT_CONNECTED'; reason: string }
  | { ok: false; status: 'UNAVAILABLE'; reason: string };

export async function callModel(modelId: string, _input: Record<string, unknown>): Promise<ModelCallResult> {
  const profile = findModelProfile(modelId);
  if (!profile) {
    return { ok: false, status: 'UNAVAILABLE', reason: `"${modelId}" is not in MESH's model registry — see adapters/model-registry/registry.ts` };
  }
  return { ok: false, status: 'NOT_CONNECTED', reason: profile.provenance.note ?? `${modelId} is NOT_CONNECTED` };
}
