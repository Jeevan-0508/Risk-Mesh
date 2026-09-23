/**
 * Composes `client.ts` (real HTTP) and `map.ts` (translation) into the one entry point a case
 * engine would actually call. Every exit path is a discriminated result — there is no code path
 * that returns a `Replay` object built from anything other than a real, live response.
 */
import { getDecision, runCounterfactual, type RiskReplayClientConfig } from './client';
import { counterfactualToReplay, mapMutationType, nonReplayableFinding } from './map';
import type { MutationType, Replay } from '../../contracts/schemas';

export type ReplayAssessment =
  | { ok: true; replay: Replay }
  | { ok: false; reason: string };

export async function assessReplayStability(
  config: RiskReplayClientConfig,
  args: { caseId: string; decisionId: string; mutationType: MutationType; target: string; reason: string; now?: string },
): Promise<ReplayAssessment> {
  const now = args.now ?? new Date().toISOString();

  const detailResult = await getDecision(config, args.decisionId);
  if (!detailResult.ok) {
    return { ok: false, reason: `risk-replay UNAVAILABLE: ${detailResult.error}` };
  }

  if (detailResult.data.replayability_status !== 'REPLAYABLE') {
    return { ok: true, replay: nonReplayableFinding(detailResult.data, args.caseId, args.decisionId, args.mutationType, now) };
  }

  const mutationMap = mapMutationType(args.mutationType);
  if (!mutationMap.ok) {
    return { ok: false, reason: mutationMap.reason };
  }

  const counterfactualResult = await runCounterfactual(config, args.decisionId, [
    { type: mutationMap.riskReplayType, target: args.target, reason: args.reason, actor: 'risk-mesh' },
  ]);
  if (!counterfactualResult.ok) {
    return { ok: false, reason: `risk-replay UNAVAILABLE: ${counterfactualResult.error}` };
  }

  return {
    ok: true,
    replay: counterfactualToReplay(counterfactualResult.data, args.caseId, args.decisionId, args.mutationType, now),
  };
}
