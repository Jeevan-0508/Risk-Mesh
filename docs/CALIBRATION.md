# Calibration from reviewed outcomes

## What is wired

`core/outcome-engine.ts` records an observed `Outcome`. Calibration now has a separate
`ModelOutcomeAssessment` contract for a human reviewer to judge one named `ModelResult` against
that outcome. The distinction matters: `Outcome.matches_prediction` describes the case's final
Decision and is never copied onto each model's result.

`evaluation/calibration/from-records.ts` exposes `runCalibrationFromRecords()`. It builds a
separate Brier score and reliability diagram for each model/checkpoint. It includes an assessment
only when all of these conditions hold:

- The case, model result, outcome, and assessment each have `LIVE` or `SNAPSHOT` provenance.
- The model result is `RECORDED` and has a confidence value.
- The assessment is `CONFIRMED` and explicitly identifies the model result, outcome, same case,
  reviewer, correctness judgment, and rationale.
- The assessment's linked model result and outcome both refer to that same case.

`SIMULATED`, `MOCKED`, `CACHED`, and `UNAVAILABLE` records are excluded. This also excludes
Fraud Watch Arena demos because their case provenance is simulated, even though their model
inference was a real captured Laya call. Duplicate assessments for the same result/outcome pair
raise an error rather than silently counting the same prediction twice. Each model result may have
only one assessment in a report, and its outcome must still be the case's linked outcome.

## Calling the report

Pass the current records from the caller's stores:

```ts
import { runCalibrationFromRecords } from '../evaluation/calibration/from-records';

const report = runCalibrationFromRecords({
  cases: caseEngine.list(),
  modelResults,
  outcomes: outcomeEngine.list(),
  assessments,
});

for (const model of report.models) {
  console.log(model.model_id, model.checkpoint, model.calibration);
}
```

The record lists must include the complete referenced objects; missing or mismatched links are
counted as excluded assessments. The function does not persist records itself. This repository's
current `OutcomeEngine` is in-memory, and there are no real MESH `Outcome` or
`ModelOutcomeAssessment` records yet, so every model report remains `INSUFFICIENT_DATA` until a
caller records real outcomes and human reviews. The 30-sample floor is still an explicit
rule-of-thumb placeholder, not a fitted MESH threshold.

## Creating an assessment

The reviewer creates one `ModelOutcomeAssessment` per model result being evaluated. Its
`provenance` should identify the actual review source and include a traceable `upstream_ref` where
available. The assessment's `correct` value is a human judgment grounded in the linked
`Outcome.actual_result` and the question that model was asked; it is not calculated by comparing
free-text strings. A reviewer may assess different models differently for the same case outcome.

No adaptive-routing threshold is applied by this report. Any routing change remains a separate
proposal and still requires a human decision.
