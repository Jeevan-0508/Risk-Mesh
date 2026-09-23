/**
 * Real Laya inference (System-1 directive, Step 2). Laya has no HTTP API — the only real, honest
 * way to call it is the actual `laya` PyPI package (`pip install laya`; confirmed real, Apache-2.0,
 * `convaiinnovations/laya*` on HuggingFace), which needs torch + transformers. Rather than pull
 * that into this repo's bun/TS dependency tree, this shells out to `scripts/laya_infer.py` via
 * `uv run` — the same "real runtime, isolated behind a narrow contract" shape risk-replay's
 * adapter uses for its FastAPI backend, just over a subprocess boundary instead of HTTP.
 *
 * Known limitation, stated honestly rather than hidden: each call here cold-loads the checkpoint
 * (~15s observed for laya-typed-decisions on CPU) because the Python process does not persist
 * between calls. Laya's own README recommends keeping the agent resident; a persistent local
 * server (matching risk-replay's own FastAPI pattern) is the natural follow-up once this simpler
 * path is proven correct — not built now, to keep this slice small.
 */
import { spawnSync } from 'bun';
import { fileURLToPath } from 'url';

export type LayaQuestion = {
  type: 'choice' | 'score' | 'noul';
  instructions: string;
  criteria?: Record<string, string | null> | string[];
};

export type LayaInferenceInput = {
  checkpoint: string;
  state: string | Record<string, unknown> | unknown[];
  questions: Record<string, LayaQuestion>;
};

export type LayaRawAnswer = {
  type: 'choice' | 'score' | 'noul';
  choice?: string;
  score?: number;
  noul?: number;
  probabilities?: Record<string, number>;
  confidence: number;
  action?: { act_probability: number };
  legend?: Record<string, string>;
};

export type LayaRawResult = {
  model: string;
  answers: Record<string, LayaRawAnswer>;
  usage: { input_tokens: number; output_tokens: number };
};

export type LayaRuntimeResult =
  | { ok: true; load_seconds: number; infer_seconds: number; result: LayaRawResult }
  | { ok: false; error: string };

const SCRIPT_PATH = fileURLToPath(new URL('../../scripts/laya_infer.py', import.meta.url));

/** Real subprocess call. Not exercised by the default `bun test` run (see laya-runtime.test.ts) —
 * it needs a working `uv` + network + torch, which CI/other machines may not have; gating it
 * behind an explicit call site keeps the default suite fast and always green. */
export function callLayaSubprocess(input: LayaInferenceInput, timeoutMs = 60_000): LayaRuntimeResult {
  const proc = spawnSync({
    cmd: ['uv', 'run', '--with', 'laya', 'python', SCRIPT_PATH],
    stdin: Buffer.from(JSON.stringify(input)),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, USE_TF: '0', HF_HUB_DISABLE_SYMLINKS: '1' },
    timeout: timeoutMs,
  });

  if (proc.exitCode !== 0) {
    const stderr = proc.stderr.toString('utf-8').trim();
    return { ok: false, error: `laya_infer.py exited ${proc.exitCode}: ${stderr.slice(-2000) || '(no stderr)'}` };
  }

  const stdout = proc.stdout.toString('utf-8').trim();
  try {
    const parsed = JSON.parse(stdout);
    return parsed as LayaRuntimeResult;
  } catch (e) {
    return { ok: false, error: `laya_infer.py produced non-JSON stdout: ${stdout.slice(0, 500)}` };
  }
}

/** Normalized Shannon entropy in [0,1] of a real probability distribution — MESH-computed, not a
 * native Laya field (see ModelResult.uncertainty's doc comment in contracts/schemas.ts). */
export function shannonUncertainty(probabilities: Record<string, number> | undefined | null): number | null {
  if (!probabilities) return null;
  const values = Object.values(probabilities).filter((p) => p > 0);
  const k = Object.keys(probabilities).length;
  if (k <= 1) return 0;
  const entropy = -values.reduce((sum, p) => sum + p * Math.log(p), 0);
  return entropy / Math.log(k);
}

/** Pure mapping from Laya's real raw answer to MESH's ModelResult shape (§7). No subprocess, no
 * network — safe to unit-test against a captured fixture. */
export function mapLayaAnswerToModelResultFields(answer: LayaRawAnswer) {
  const decision = answer.type === 'choice' ? (answer.choice ?? '')
    : answer.type === 'score' ? String(answer.score ?? '')
    : String(answer.noul ?? '');

  return {
    decision,
    probabilities: answer.probabilities ?? null,
    confidence: answer.confidence,
    uncertainty: shannonUncertainty(answer.probabilities),
    primitive: answer.type,
    raw_output: answer as Record<string, unknown>,
  };
}
