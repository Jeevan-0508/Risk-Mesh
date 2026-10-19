import { createHash } from 'node:crypto';
import type {
  Case,
  Challenge,
  Decision,
  Evidence,
  HumanRecommendation,
  Replay,
  Review,
  Signal,
  Trust,
  TrustDrivers,
} from '../contracts/schemas';
import { validateMeshObject } from '../contracts/validate';
import { CaseEngine } from './case-engine';
import { EvidenceFabric } from './evidence-fabric';
import { Ledger } from './ledger';
import { decideArbitrationAction } from './arbitration-engine';
import { computeTrustVerdict } from './trust-engine';

/**
 * A deterministic, synthetic Olympus vertical slice.
 *
 * This module deliberately has no model or network dependency. It exercises the same
 * governance boundaries that a live adapter must obey: content is hashed, untrusted
 * instructions become a security signal, findings cite evidence ids, decisions carry
 * rationale, replay is scoped to the rule-based decision, and high-impact actions remain
 * human-gated.
 */

export type OlympusImpact = 'STANDARD' | 'HIGH';
export type OlympusFindingStatus = 'SUPPORTED' | 'MISSING' | 'FLAGGED';
export type OlympusSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface OlympusDocumentInput {
  id: string;
  name: string;
  content: string;
  sourceType?: string;
}

export interface OlympusScenario {
  id: string;
  aiSystem: { id: string; name: string; purpose: string; impact: OlympusImpact };
  documents: OlympusDocumentInput[];
  now: string;
  reviewer: string;
  humanDecision?: HumanRecommendation;
}

export interface OlympusFinding {
  id: string;
  title: string;
  status: OlympusFindingStatus;
  severity: OlympusSeverity;
  rule: string;
  requirement: string;
  evidenceIds: string[];
  uncertainty: string;
}

export interface OlympusRiskEdge {
  id: string;
  from: string;
  to: string;
  relation: 'SUPPORTED_BY' | 'MITIGATED_BY' | 'CHALLENGED_BY' | 'DERIVED_FROM';
  source: string;
}

export interface OlympusAlert {
  id: string;
  severity: OlympusSeverity;
  queue: 'human-review' | 'governance-ops';
  title: string;
  findingId: string;
  slaHours: number;
  status: 'OPEN';
}

export interface OlympusRemediation {
  id: string;
  findingId: string;
  owner: string;
  title: string;
  status: 'OPEN';
}

export interface OlympusReport {
  facts: string[];
  interpretations: string[];
  recommendations: string[];
  sourceIds: string[];
}

export type OlympusEventType =
  | 'AI_SYSTEM_REGISTERED'
  | 'DOCUMENT_UPLOADED'
  | 'EVIDENCE_EXTRACTED'
  | 'CONTROLS_EVALUATED'
  | 'FINDINGS_CREATED'
  | 'RISK_PRIORITIZED'
  | 'AGENT_REVIEW_REQUESTED'
  | 'HUMAN_APPROVAL_REQUIRED'
  | 'AUDIT_RECORDED';

export interface OlympusEvent {
  id: string;
  type: OlympusEventType;
  correlationId: string;
  at: string;
  payload: Record<string, unknown>;
  attempt: number;
}

class IdempotentEventLog {
  private readonly events: OlympusEvent[] = [];
  private readonly byId = new Map<string, OlympusEvent>();

  emit(event: Omit<OlympusEvent, 'attempt'>): OlympusEvent {
    const existing = this.byId.get(event.id);
    if (existing) return existing;
    const stored = { ...event, attempt: 1 };
    this.events.push(stored);
    this.byId.set(stored.id, stored);
    return stored;
  }

  list(): readonly OlympusEvent[] {
    return this.events;
  }
}

const INJECTION_PATTERNS = [
  /ignore (?:all |any )?(?:previous|prior|above) instructions/i,
  /disregard (?:all |any )?(?:previous|prior|above) (?:instructions|rules)/i,
  /mark this (?:policy|document|control|requirement) (?:as )?(?:compliant|passed|satisfied)/i,
  /system prompt:/i,
  /override your (?:instructions|guidelines|rules)/i,
];

const CONTROL_RULES = [
  { id: 'human-oversight', label: 'human approval or override', pattern: /human (?:approval|review|override)|operator may override/i, requirement: 'High-impact actions require human authorization.' },
  { id: 'audit-logging', label: 'audit logging', pattern: /audit trail|events? (?:are )?logged|logging/i, requirement: 'Material decisions must be traceable in an audit record.' },
  { id: 'risk-management', label: 'risk management', pattern: /risk (?:register|assessment|management)/i, requirement: 'The AI system must have a documented risk-management process.' },
  { id: 'least-privilege', label: 'least-privilege tool access', pattern: /least privilege|allowlist|restricted tools?|tool permissions?/i, requirement: 'Agent tools must be explicitly bounded by authorization policy.' },
] as const;

function hashContent(content: string): string {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function provenance(now: string, note: string | null = null) {
  return { source: 'SIMULATED' as const, system: 'olympus-deterministic-demo', retrieved_at: now, upstream_ref: null, note };
}

function base(id: string, status: string, now: string, caseId?: string | null) {
  return {
    id,
    schema_version: '1.0',
    created_at: now,
    source: 'olympus-deterministic-demo',
    provenance: provenance(now),
    status,
    ...(caseId === undefined ? {} : { case_id: caseId }),
  };
}

function validate(kind: Parameters<typeof validateMeshObject>[0], value: unknown): void {
  const result = validateMeshObject(kind, value);
  if (!result.ok) throw new Error(`Olympus ${kind} contract failed: ${result.errors.join('; ')}`);
}

function scanInjection(content: string): string[] {
  return INJECTION_PATTERNS.flatMap((pattern) => {
    const match = content.match(pattern);
    return match ? [match[0]] : [];
  });
}

function humanRecommendationFor(action: Decision['action']): HumanRecommendation {
  if (action === 'ACCEPT' || action === 'ACCEPT_SYSTEM1') return 'APPROVE';
  if (action === 'ABSTAIN' || action === 'HUMAN_REVIEW' || action === 'REQUIRE_DEEP_REVIEW') return 'HUMAN_REQUIRED';
  if (action === 'REQUEST_REPLAY' || action === 'REQUEST_MORE_EVIDENCE') return 'INVESTIGATE';
  if (action === 'ESCALATE_TO_SWARM') return 'ESCALATE';
  return 'MONITOR';
}

export interface OlympusRun {
  scenarioId: string;
  case: Case;
  evidence: Evidence[];
  signals: Signal[];
  findings: OlympusFinding[];
  graph: OlympusRiskEdge[];
  alerts: OlympusAlert[];
  remediation: OlympusRemediation[];
  decision: Decision;
  challenge: Challenge | null;
  replay: Replay;
  trust: Trust;
  review: Review;
  events: readonly OlympusEvent[];
  report: OlympusReport;
}

export function runOlympusScenario(scenario: OlympusScenario): OlympusRun {
  if (!scenario.documents.length) throw new Error('Olympus scenario requires at least one document');
  const eventLog = new IdempotentEventLog();
  const ledger = new Ledger();
  const evidenceFabric = new EvidenceFabric(ledger);
  const caseEngine = new CaseEngine(ledger);
  const correlationId = `corr-${scenario.id}`;

  eventLog.emit({ id: `${scenario.id}:system`, type: 'AI_SYSTEM_REGISTERED', correlationId, at: scenario.now, payload: { aiSystem: scenario.aiSystem } });

  const evidence: Evidence[] = [];
  const signals: Signal[] = [];
  const evidenceByDocument = new Map<string, string>();
  const injectionByDocument = new Map<string, string[]>();

  for (const document of scenario.documents) {
    const contentHash = hashContent(document.content);
    const evidenceId = `evidence-${document.id}`;
    const injectionFlags = scanInjection(document.content);
    const item: Evidence = {
      ...base(evidenceId, 'UNVERIFIED', scenario.now, `case-${scenario.id}`),
      status: 'UNVERIFIED',
      source_type: document.sourceType ?? 'synthetic-document',
      observed_at: scenario.now,
      content_hash: contentHash,
      reliability: document.content.trim() ? 0.9 : 0,
      independent: true,
    };
    validate('evidence', item);
    evidenceFabric.add(item);
    const verified = evidenceFabric.transition(evidenceId, 'VERIFIED', 'content hash recorded and deterministic ingestion completed', scenario.now);
    evidence.push(verified);
    evidenceByDocument.set(document.id, evidenceId);
    injectionByDocument.set(document.id, injectionFlags);
    eventLog.emit({ id: `${scenario.id}:document:${document.id}`, type: 'DOCUMENT_UPLOADED', correlationId, at: scenario.now, payload: { documentId: document.id, contentHash } });
    eventLog.emit({ id: `${scenario.id}:evidence:${document.id}`, type: 'EVIDENCE_EXTRACTED', correlationId, at: scenario.now, payload: { evidenceId, documentId: document.id } });

    if (injectionFlags.length) {
      const signal: Signal = {
        ...base(`signal-injection-${document.id}`, 'RAW', scenario.now, `case-${scenario.id}`),
        status: 'RAW',
        signal_type: 'PROMPT_INJECTION_CONTENT',
        payload: { documentId: document.id, matches: injectionFlags, handling: 'ignored-as-data' },
        external: false,
      };
      validate('signal', signal);
      signals.push(signal);
    }
  }

  const caseObj: Case = {
    ...base(`case-${scenario.id}`, 'OPEN', scenario.now),
    status: 'OPEN',
    title: `Olympus assessment: ${scenario.aiSystem.name}`,
    summary: scenario.aiSystem.purpose,
    signal_ids: signals.map((signal) => signal.id),
    entity_ids: [scenario.aiSystem.id],
    behavior_ids: [],
    decision_ids: [],
    disagreement_ids: [],
    challenge_ids: [],
    replay_ids: [],
    outcome_id: null,
    lesson_ids: [],
    evidence_ids: evidence.map((item) => item.id),
  };
  validate('case', caseObj);
  caseEngine.create(caseObj);

  const findings: OlympusFinding[] = [];
  const graph: OlympusRiskEdge[] = [];
  let findingSequence = 0;
  for (const rule of CONTROL_RULES) {
    const matchingEvidence = scenario.documents
      .filter((document) => rule.pattern.test(document.content))
      .map((document) => evidenceByDocument.get(document.id)!)
      .filter(Boolean);
    const status: OlympusFindingStatus = matchingEvidence.length ? 'SUPPORTED' : 'MISSING';
    const severity: OlympusSeverity = status === 'MISSING' && rule.id !== 'risk-management' ? 'HIGH' : status === 'MISSING' ? 'MEDIUM' : 'LOW';
    const finding: OlympusFinding = {
      id: `finding-${++findingSequence}`,
      title: `${status === 'SUPPORTED' ? 'Supported' : 'Missing'} ${rule.label}`,
      status,
      severity,
      rule: rule.id,
      requirement: rule.requirement,
      evidenceIds: matchingEvidence,
      uncertainty: status === 'SUPPORTED' ? 'Deterministic keyword match does not establish legal compliance.' : 'Missing evidence is not confirmed noncompliance; human review is required.',
    };
    findings.push(finding);
    for (const evidenceId of matchingEvidence) graph.push({ id: `edge-${finding.id}-${evidenceId}`, from: finding.id, to: evidenceId, relation: 'SUPPORTED_BY', source: `rule:${rule.id}` });
  }

  for (const [documentId, matches] of injectionByDocument) {
    if (!matches.length) continue;
    const finding: OlympusFinding = {
      id: `finding-${++findingSequence}`,
      title: 'Prompt-injection content detected in source document',
      status: 'FLAGGED',
      severity: 'HIGH',
      rule: 'prompt-injection-defense',
      requirement: 'Untrusted document content must not override system instructions or authorize tools.',
      evidenceIds: [evidenceByDocument.get(documentId)!],
      uncertainty: 'The scanner identifies instruction-like text; it does not infer author intent.',
    };
    findings.push(finding);
    const evidenceId = finding.evidenceIds[0];
    if (!evidenceId) throw new Error(`prompt-injection finding ${finding.id} has no source evidence`);
    graph.push({ id: `edge-${finding.id}-${evidenceId}`, from: finding.id, to: evidenceId, relation: 'SUPPORTED_BY', source: 'rule:prompt-injection-defense' });
  }

  eventLog.emit({ id: `${scenario.id}:controls`, type: 'CONTROLS_EVALUATED', correlationId, at: scenario.now, payload: { findingCount: findings.length, deterministic: true } });
  eventLog.emit({ id: `${scenario.id}:findings`, type: 'FINDINGS_CREATED', correlationId, at: scenario.now, payload: { findingIds: findings.map((finding) => finding.id) } });

  const highImpactGate = scenario.aiSystem.impact === 'HIGH';
  const hasSecurityFlag = findings.some((finding) => finding.rule === 'prompt-injection-defense');
  const hasMissingCriticalControl = findings.some((finding) => finding.status === 'MISSING' && finding.severity === 'HIGH');
  const replayStability = !highImpactGate && !hasSecurityFlag && !hasMissingCriticalControl ? 0.9 : 0.2;
  const drivers: TrustDrivers = {
    evidence_quality: evidence.every((item) => item.reliability > 0) ? 0.9 : 0,
    evidence_independence: evidence.length > 1 && evidence.every((item) => item.independent) ? 0.9 : 0.4,
    model_calibration: null,
    model_historical_accuracy: null,
    model_agreement: null,
    novelty: 0.2,
    replay_stability: replayStability,
    contradiction_count: 0,
    source_quality: 0.9,
    human_validation: scenario.humanDecision !== undefined,
  };
  const trustAssessment = computeTrustVerdict(drivers);
  const trust: Trust = {
    ...base(`trust-${scenario.id}`, trustAssessment.verdict, scenario.now, `case-${scenario.id}`),
    status: trustAssessment.verdict,
    case_id: `case-${scenario.id}`,
    drivers,
  };
  validate('trust', trust);

  const arbitration = decideArbitrationAction(trustAssessment, { swarmAvailable: false, replayAlreadyRun: true, moreEvidenceRequestable: findings.some((finding) => finding.status !== 'SUPPORTED') });
  const action = highImpactGate || hasSecurityFlag || hasMissingCriticalControl ? 'HUMAN_REVIEW' : arbitration.action;
  const rationale = [...arbitration.rationale];
  if (highImpactGate) rationale.push('high-impact system gate: human authorization is required before action.');
  if (hasSecurityFlag) rationale.push('prompt-injection signal is preserved as data and blocks autonomous action.');

  const decision: Decision = {
    ...base(`decision-${scenario.id}`, 'DRAFT', scenario.now, `case-${scenario.id}`),
    status: 'DRAFT',
    case_id: `case-${scenario.id}`,
    action,
    rationale,
    decided_by: 'olympus-deterministic-policy-engine',
  };
  validate('decision', decision);
  caseEngine.attachDecision(caseObj.id, decision.id, scenario.now);
  eventLog.emit({ id: `${scenario.id}:priority`, type: 'RISK_PRIORITIZED', correlationId, at: scenario.now, payload: { action, trust: trust.status } });

  const challenge: Challenge | null = hasSecurityFlag ? {
    ...base(`challenge-${scenario.id}`, 'OPEN', scenario.now, `case-${scenario.id}`),
    status: 'OPEN',
    case_id: `case-${scenario.id}`,
    target_decision_id: decision.id,
    challenge_type: 'PROMPT_INJECTION',
    finding: 'The source document contains instruction-like text that must not influence the decision engine.',
  } : null;
  if (challenge) {
    validate('challenge', challenge);
    caseEngine.attachChallenge(caseObj.id, challenge.id, scenario.now);
    eventLog.emit({ id: `${scenario.id}:agent-review`, type: 'AGENT_REVIEW_REQUESTED', correlationId, at: scenario.now, payload: { challengeId: challenge.id, role: 'ARES' } });
  }

  const replay: Replay = {
    ...base(`replay-${scenario.id}`, replayStability >= 0.5 ? 'STABLE' : 'FRAGILE', scenario.now, `case-${scenario.id}`),
    status: replayStability >= 0.5 ? 'STABLE' : 'FRAGILE',
    case_id: `case-${scenario.id}`,
    decision_id: decision.id,
    mutation_type: 'REMOVE_EVIDENCE',
    finding: replayStability >= 0.5
      ? 'Under the REMOVE_EVIDENCE mutation, the deterministic recommendation stayed within the same policy branch; this is replay stability, not causal proof.'
      : 'The deterministic recommendation is sensitive to a REMOVE_EVIDENCE mutation; this is a scoped replay result, not causal proof.',
  };
  validate('replay', replay);
  caseEngine.attachReplay(caseObj.id, replay.id, scenario.now);

  const review: Review = {
    ...base(`review-${scenario.id}`, scenario.humanDecision ? 'COMPLETE' : 'PENDING', scenario.now, `case-${scenario.id}`),
    status: scenario.humanDecision ? 'COMPLETE' : 'PENDING',
    case_id: `case-${scenario.id}`,
    decision_id: decision.id,
    reviewer: scenario.reviewer,
    system_recommendation: humanRecommendationFor(action),
    human_decision: scenario.humanDecision ?? null,
    rationale: scenario.humanDecision ? `Recorded explicitly by ${scenario.reviewer}; human decision is authoritative.` : null,
  };
  validate('review', review);
  if (!scenario.humanDecision) eventLog.emit({ id: `${scenario.id}:approval`, type: 'HUMAN_APPROVAL_REQUIRED', correlationId, at: scenario.now, payload: { reviewId: review.id, reviewer: scenario.reviewer } });

  const alerts: OlympusAlert[] = findings.filter((finding) => finding.status !== 'SUPPORTED').map((finding) => ({
    id: `alert-${finding.id}`,
    severity: finding.severity,
    queue: 'human-review',
    title: finding.title,
    findingId: finding.id,
    slaHours: finding.severity === 'HIGH' ? 24 : 72,
    status: 'OPEN',
  }));
  const remediation: OlympusRemediation[] = findings.filter((finding) => finding.status !== 'SUPPORTED').map((finding) => ({
    id: `remediation-${finding.id}`,
    findingId: finding.id,
    owner: 'AI Governance',
    title: `Resolve ${finding.title.toLowerCase()} and attach source evidence`,
    status: 'OPEN',
  }));
  eventLog.emit({ id: `${scenario.id}:audit`, type: 'AUDIT_RECORDED', correlationId, at: scenario.now, payload: { ledgerEvents: ledger.list().length, reviewId: review.id } });

  const finalCase = caseEngine.get(caseObj.id)!;
  const sourceIds = [...evidence.map((item) => item.id), ...signals.map((signal) => signal.id), ...findings.flatMap((finding) => finding.evidenceIds)];
  return {
    scenarioId: scenario.id,
    case: finalCase,
    evidence,
    signals,
    findings,
    graph,
    alerts,
    remediation,
    decision,
    challenge,
    replay,
    trust,
    review,
    events: eventLog.list(),
    report: {
      facts: [
        `Registered ${scenario.aiSystem.name} (${scenario.aiSystem.id}) for synthetic assessment.`,
        `${evidence.length} document(s) were hashed and deterministically ingested.`,
        `${findings.filter((finding) => finding.status !== 'SUPPORTED').length} finding(s) require follow-up.`,
        `Replay status: ${replay.status}; trust status: ${trust.status}.`,
      ],
      interpretations: ['Deterministic rule results are evidence-linked signals, not legal conclusions.', 'Human approval remains authoritative for the final action.'],
      recommendations: remediation.map((item) => item.title),
      sourceIds: [...new Set(sourceIds)],
    },
  };
}

