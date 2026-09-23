/**
 * Composes `map.ts`'s pure translation functions into the entry points a case engine would call.
 * There is no `client.ts` counterpart (see `types.ts`): the caller must already have a real
 * `CouncilResult`, from wherever it actually ran, and say so honestly via `provenanceSource`.
 */
import type { Disagreement, ModelResult } from '../../contracts/schemas';
import { agreementToModelAgreementScore, councilPositionsToModelResults, councilToDisagreement, type MapArgs } from './map';
import type { CouncilResult } from './types';

export interface RiskSwarmAssessment {
  modelResults: ModelResult[];
  disagreement: Disagreement | null;
  disagreementSkippedReason: string | null;
  /** Feeds directly into `TrustDrivers.model_agreement` (spec §34) once a case is scored. */
  modelAgreementScore: number;
}

export function assessCouncilResult(result: CouncilResult, args: MapArgs): RiskSwarmAssessment {
  const modelResults = councilPositionsToModelResults(result, args);
  const disagreementResult = councilToDisagreement(result, args);

  return {
    modelResults,
    disagreement: disagreementResult.ok ? disagreementResult.disagreement : null,
    disagreementSkippedReason: disagreementResult.ok ? null : disagreementResult.reason,
    modelAgreementScore: agreementToModelAgreementScore(result.disagreement.agreement),
  };
}
