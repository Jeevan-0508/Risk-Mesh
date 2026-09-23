/**
 * A thin fetch wrapper over risk-replay's real FastAPI backend (`backend/app/api/main.py`).
 * Every type here mirrors risk-replay's own pydantic schema field-for-field (snake_case, its
 * vocabulary, not MESH's) — translation into MESH contracts happens in `map.ts`, never here, so a
 * failed translation is always visible as a separate, inspectable step.
 *
 * On any network failure, timeout, or non-2xx response this returns `status: 'UNAVAILABLE'` rather
 * than throwing or fabricating a result. There is no fallback to mock/simulated data (§58).
 */

export interface RiskReplayClientConfig {
  baseUrl: string;
  timeoutMs?: number;
}

export type FetchResult<T> =
  | { ok: true; status: 'LIVE'; data: T }
  | { ok: false; status: 'UNAVAILABLE'; error: string };

async function request<T>(config: RiskReplayClientConfig, path: string, init?: RequestInit): Promise<FetchResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 3000);
  try {
    const response = await fetch(new URL(path, config.baseUrl), { ...init, signal: controller.signal });
    if (!response.ok) {
      return { ok: false, status: 'UNAVAILABLE', error: `HTTP ${response.status} from ${path}` };
    }
    const data = (await response.json()) as T;
    return { ok: true, status: 'LIVE', data };
  } catch (error) {
    return { ok: false, status: 'UNAVAILABLE', error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

export interface RiskReplayEvidenceOut {
  evidence_id: string;
  source: string;
  kind: string;
  value: number;
  weight: number;
  classification: string;
  retrieved_by: string | null;
  content_hash: string;
}

export interface RiskReplayDecisionDetail {
  decision_id: string;
  system: string;
  timestamp: string;
  model_id: string;
  policy_id: string;
  decision: string;
  final_outcome: string;
  confidence: number;
  risk_score: number;
  evidence_count: number;
  incident_id: string | null;
  evidence: RiskReplayEvidenceOut[];
  controls: Array<{ control_id: string; status: string; reason: string }>;
  tool_invocations: Array<{ tool_id: string; tool_name: string; output: unknown; deterministic: boolean }>;
  context_hash: string;
  replayability_status: string;
  replayability_reasons: string[];
}

/** Wire shape of `MutationIn` (backend/app/api/schemas.py) — risk-replay's mutation vocabulary. */
export interface RiskReplayMutationIn {
  type:
    | 'REMOVE_EVIDENCE' | 'ADD_EVIDENCE' | 'MODIFY_EVIDENCE' | 'CHANGE_POLICY' | 'CHANGE_MODEL'
    | 'CHANGE_THRESHOLD' | 'REMOVE_TOOL_RESULT' | 'MODIFY_TOOL_RESULT' | 'CHANGE_INPUT' | 'DISABLE_CONTROL';
  target: string;
  reason: string;
  actor?: string;
  payload?: Record<string, unknown>;
}

export interface RiskReplayCounterfactualOut {
  counterfactual_id: string;
  decision_id: string;
  original_outcome: string;
  original_score: number;
  counterfactual_outcome: string;
  counterfactual_score: number;
  diverged: boolean;
  score_delta: number;
  causal_status: string;
  causal_explanation: string;
  is_multi_variable: boolean;
  diff_fields: Array<{ field: string; original: unknown; replay: unknown; changed: boolean }>;
}

export function health(config: RiskReplayClientConfig) {
  return request<{ status: string; service: string }>(config, '/health');
}

export function getDecision(config: RiskReplayClientConfig, decisionId: string) {
  return request<RiskReplayDecisionDetail>(config, `/decisions/${encodeURIComponent(decisionId)}`);
}

export function runCounterfactual(config: RiskReplayClientConfig, decisionId: string, mutations: RiskReplayMutationIn[]) {
  return request<RiskReplayCounterfactualOut>(config, `/decisions/${encodeURIComponent(decisionId)}/counterfactual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mutations }),
  });
}
