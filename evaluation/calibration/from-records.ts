/**
 * Turns explicitly human-reviewed MESH records into per-model calibration reports.
 *
 * Eligibility is deliberately narrow: the case, assessment, model result, and outcome must all
 * carry LIVE or SNAPSHOT provenance; the model result must have a confidence value; and the
 * assessment must link that exact result and the case's current outcome to the same case.
 * SIMULATED, MOCKED, CACHED, and UNAVAILABLE records are excluded. In particular, Fraud Watch
 * demo labels never enter this path.
 */
import type { Case, ModelOutcomeAssessment, ModelResult, Outcome } from '../../contracts/schemas';
import { CALIBRATION_THRESHOLDS, computeCalibration, type CalibrationResult } from './pipeline';

export type CalibrationRecords = {
  cases: Case[];
  modelResults: ModelResult[];
  outcomes: Outcome[];
  assessments: ModelOutcomeAssessment[];
};

export type ModelCalibrationReport = {
  model_id: string;
  checkpoint: string;
  calibration: CalibrationResult;
  includedAssessments: number;
};

export type RecordCalibrationReport = {
  /** Per-model only: confidence values from different models are never pooled. */
  models: ModelCalibrationReport[];
  eligibleAssessmentCount: number;
  excludedAssessmentCount: number;
};

const REAL_PROVENANCE = new Set(['LIVE', 'SNAPSHOT']);

function isEligibleProvenance(source: string): boolean {
  return REAL_PROVENANCE.has(source);
}

/**
 * Build a calibration report from stored records. A reviewer must explicitly mark each model
 * result correct/incorrect; this function never derives correctness from free text or from the
 * case-level Outcome.matches_prediction field.
 */
export function runCalibrationFromRecords(
  records: CalibrationRecords,
  thresholds: { minimumSampleSize: number; bucketCount: number } = CALIBRATION_THRESHOLDS,
): RecordCalibrationReport {
  const resultsById = new Map<string, ModelResult>(records.modelResults.map((result) => [result.id, result] as const));
  const outcomesById = new Map<string, Outcome>(records.outcomes.map((outcome) => [outcome.id, outcome] as const));
  const casesById = new Map<string, Case>(records.cases.map((caseRecord) => [caseRecord.id, caseRecord] as const));
  const seenModelResults = new Set<string>();
  const samplesByModel = new Map<string, { model_id: string; checkpoint: string; samples: { confidence: number; correct: boolean }[] }>();
  let eligibleAssessmentCount = 0;
  let excludedAssessmentCount = 0;

  // Keep zero-sample model rows visible so an empty/blocked calibration is clear per checkpoint.
  for (const result of records.modelResults) {
    const modelKey = `${result.model_id}\u0000${result.checkpoint}`;
    if (!samplesByModel.has(modelKey)) {
      samplesByModel.set(modelKey, { model_id: result.model_id, checkpoint: result.checkpoint, samples: [] });
    }
  }

  for (const assessment of records.assessments) {
    if (seenModelResults.has(assessment.model_result_id)) {
      throw new Error(`Model result ${assessment.model_result_id} has more than one calibration assessment.`);
    }
    seenModelResults.add(assessment.model_result_id);

    const result = resultsById.get(assessment.model_result_id);
    const outcome = outcomesById.get(assessment.outcome_id);
    const caseRecord = casesById.get(assessment.case_id);
    const eligible = assessment.status === 'CONFIRMED'
      && Boolean(result && outcome && caseRecord)
      && result?.status === 'RECORDED'
      && (outcome?.status === 'RECORDED' || outcome?.status === 'AMENDED');

    // Spell out the remaining checks separately to keep provenance and identity gates auditable.
    const linkedRecordsMatch = Boolean(result && outcome && caseRecord
      && result.case_id === assessment.case_id
      && outcome.case_id === assessment.case_id
      && caseRecord.outcome_id === outcome.id
      && caseRecord.decision_ids.includes(outcome.decision_id)
      && isEligibleProvenance(caseRecord.provenance.source)
      && isEligibleProvenance(assessment.provenance.source)
      && isEligibleProvenance(result.provenance.source)
      && isEligibleProvenance(outcome.provenance.source)
      && result.confidence !== null);

    if (!eligible || !linkedRecordsMatch || !result || result.confidence === null) {
      excludedAssessmentCount += 1;
      continue;
    }

    const modelKey = `${result.model_id}\u0000${result.checkpoint}`;
    let model = samplesByModel.get(modelKey);
    if (!model) {
      model = { model_id: result.model_id, checkpoint: result.checkpoint, samples: [] };
      samplesByModel.set(modelKey, model);
    }
    model.samples.push({ confidence: result.confidence, correct: assessment.correct });
    eligibleAssessmentCount += 1;
  }

  const models = [...samplesByModel.values()].map(({ model_id, checkpoint, samples }) => ({
    model_id,
    checkpoint,
    calibration: computeCalibration(samples, thresholds),
    includedAssessments: samples.length,
  }));

  return { models, eligibleAssessmentCount, excludedAssessmentCount };
}
