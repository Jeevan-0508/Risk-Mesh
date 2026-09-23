/**
 * `callModel()` has exactly one real success path: `laya-typed`, via `laya-runtime.ts`'s real
 * subprocess call to the actual `laya` package (System-1 directive Step 2). Every other model
 * still fails closed with `UNAVAILABLE` (per §9/§10: "never fabricate Jev results, never simulate
 * and present as live") — Jev has no accessible runtime anywhere in this environment, and the
 * other two Laya checkpoints haven't been independently invoked yet (see registry.ts).
 *
 * `deps.layaRunner` exists so tests can inject a fixture-backed stand-in instead of spawning a
 * real subprocess that needs torch/uv/network — the default (`callLayaSubprocess`) is what
 * production actually uses.
 */
import { findModelProfile } from './registry';
import { callLayaSubprocess, mapLayaAnswerToModelResultFields, type LayaQuestion, type LayaRuntimeResult } from './laya-runtime';
import type { ModelResult } from '../../contracts/schemas';

export type ModelCallInput = {
  case_id?: string;
  state?: string | Record<string, unknown> | unknown[];
  question?: LayaQuestion;
};

export type ModelCallResult =
  | { ok: true; status: 'SHADOW'; result: ModelResult }
  | { ok: false; status: 'UNAVAILABLE'; reason: string }
  | { ok: false; status: 'ERROR'; reason: string };

export type CallModelDeps = {
  layaRunner?: (input: Parameters<typeof callLayaSubprocess>[0]) => LayaRuntimeResult;
  now?: () => string;
};

const QUESTION_ID = 'q';

export async function callModel(modelId: string, input: ModelCallInput, deps: CallModelDeps = {}): Promise<ModelCallResult> {
  const profile = findModelProfile(modelId);
  if (!profile) {
    return { ok: false, status: 'UNAVAILABLE', reason: `"${modelId}" is not in MESH's model registry - see adapters/model-registry/registry.ts` };
  }

  if (modelId !== 'laya-typed') {
    return { ok: false, status: 'UNAVAILABLE', reason: profile.provenance.note ?? `${modelId} is UNAVAILABLE` };
  }

  if (!input.state || !input.question) {
    return { ok: false, status: 'ERROR', reason: 'laya-typed call requires both `state` and `question` in the input; got neither a fabricated result nor a silent skip.' };
  }

  const runner = deps.layaRunner ?? callLayaSubprocess;
  const now = deps.now ?? (() => new Date().toISOString());

  const raw = runner({
    checkpoint: profile.checkpoint,
    state: input.state,
    questions: { [QUESTION_ID]: input.question },
  });

  if (!raw.ok) {
    return { ok: false, status: 'ERROR', reason: `laya-typed runtime call failed: ${raw.error}` };
  }

  const answer = raw.result.answers[QUESTION_ID];
  if (!answer) {
    return { ok: false, status: 'ERROR', reason: 'laya-typed runtime returned no answer for the submitted question - failing closed rather than fabricating one.' };
  }

  const fields = mapLayaAnswerToModelResultFields(answer);
  const retrievedAt = now();

  const result: ModelResult = {
    id: `laya-typed-modelresult-${input.case_id ?? 'unscoped'}-${retrievedAt}`,
    schema_version: '1.0',
    created_at: retrievedAt,
    source: 'model-registry-adapter',
    provenance: {
      source: 'LIVE',
      system: 'convaiinnovations',
      retrieved_at: retrievedAt,
      upstream_ref: 'https://huggingface.co/convaiinnovations/laya-typed-decisions',
      note: `real laya.load('${profile.checkpoint}').predict() call, load_seconds=${raw.load_seconds.toFixed(2)}, infer_seconds=${raw.infer_seconds.toFixed(3)}`,
    },
    status: 'RECORDED',
    case_id: input.case_id ?? 'unscoped',
    model_id: 'laya-typed',
    checkpoint: profile.checkpoint,
    decision: fields.decision,
    probabilities: fields.probabilities,
    confidence: fields.confidence,
    uncertainty: fields.uncertainty,
    primitive: fields.primitive,
    latency_ms: Math.round(raw.infer_seconds * 1000),
    raw_output: fields.raw_output,
  };

  return { ok: true, status: 'SHADOW', result };
}
