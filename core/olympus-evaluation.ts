import type { ArbitrationAction } from '../contracts/schemas';

export interface DeterministicEvaluationCase {
  id: string;
  expectedHumanReview: boolean;
  observedAction: ArbitrationAction;
  rerunAction: ArbitrationAction;
  latencyMs: number;
}

export interface DeterministicEvaluationMetrics {
  datasetVersion: string;
  sampleCount: number;
  precision: number;
  recall: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  escalationAccuracy: number;
  reproducibility: number;
  averageLatencyMs: number;
}

const isHumanReview = (action: ArbitrationAction): boolean => action === 'HUMAN_REVIEW' || action === 'REQUIRE_DEEP_REVIEW';
const rate = (numerator: number, denominator: number): number => denominator === 0 ? 0 : Number((numerator / denominator).toFixed(4));

export function evaluateDeterministicCases(datasetVersion: string, cases: DeterministicEvaluationCase[]): DeterministicEvaluationMetrics {
  if (!datasetVersion.trim()) throw new Error('datasetVersion is required');
  if (!cases.length) throw new Error('at least one evaluation case is required');
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;
  let escalationCorrect = 0;
  let totalLatency = 0;
  let reproducible = 0;
  for (const item of cases) {
    if (!Number.isFinite(item.latencyMs) || item.latencyMs < 0) throw new Error(`invalid latency for ${item.id}`);
    const observed = isHumanReview(item.observedAction);
    const rerun = isHumanReview(item.rerunAction);
    if (item.expectedHumanReview && observed) truePositive += 1;
    else if (item.expectedHumanReview && !observed) falseNegative += 1;
    else if (!item.expectedHumanReview && observed) falsePositive += 1;
    else trueNegative += 1;
    if (observed === item.expectedHumanReview) escalationCorrect += 1;
    if (observed === rerun) reproducible += 1;
    totalLatency += item.latencyMs;
  }
  return {
    datasetVersion,
    sampleCount: cases.length,
    precision: rate(truePositive, truePositive + falsePositive),
    recall: rate(truePositive, truePositive + falseNegative),
    falsePositiveRate: rate(falsePositive, falsePositive + trueNegative),
    falseNegativeRate: rate(falseNegative, falseNegative + truePositive),
    escalationAccuracy: rate(escalationCorrect, cases.length),
    reproducibility: rate(reproducible, cases.length),
    averageLatencyMs: Number((totalLatency / cases.length).toFixed(2)),
  };
}

