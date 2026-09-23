/**
 * Generates the Observatory's System-1 data file from a real Arena run against two real
 * fraud-watch MOs, using a `layaRunner` that replays the exact real captures documented in
 * `adapters/model-registry/__fixtures__/PROVENANCE.md` (never re-spawns a subprocess at build
 * time):
 *
 *   bun run observatory/scripts/capture-system1-events.ts
 *
 * Like the golden-cases capture, this is a replay of a real run, not a live view: MESH has no
 * production traffic, and `decideSystem1Action()`'s output is a SHADOW recommendation only —
 * nothing in this repo wires it into a case's authoritative Decision yet (docs/MODEL_ARENA.md).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { readMoRecords } from '../../adapters/fraud-watch/client';
import { moRecordToBehavior } from '../../adapters/fraud-watch/map';
import { evaluateBehaviorViaSystem1 } from '../../evaluation/system1-arena/fraud-watch-cases';
import type { LayaInferenceInput, LayaRuntimeResult } from '../../adapters/model-registry/laya-runtime';
import type { Behavior, ModelResult } from '../../contracts/schemas';

import typedMo1 from '../../adapters/model-registry/__fixtures__/laya-typed-fraud-watch-mo0001-call.json';
import englishMo1 from '../../adapters/model-registry/__fixtures__/laya-english-fraud-watch-mo0001-call.json';
import multilingualMo1 from '../../adapters/model-registry/__fixtures__/laya-multilingual-fraud-watch-mo0001-call.json';
import typedMo2 from '../../adapters/model-registry/__fixtures__/laya-typed-fraud-watch-mo0002-call.json';
import englishMo2 from '../../adapters/model-registry/__fixtures__/laya-english-fraud-watch-mo0002-call.json';
import multilingualMo2 from '../../adapters/model-registry/__fixtures__/laya-multilingual-fraud-watch-mo0002-call.json';

const FIXTURES_BY_CHECKPOINT_AND_MO: Record<string, Record<string, any>> = {
  'convaiinnovations/laya-typed-decisions': { 'MO-0001': typedMo1, 'MO-0002': typedMo2 },
  'convaiinnovations/laya': { 'MO-0001': englishMo1, 'MO-0002': englishMo2 },
  'convaiinnovations/laya-multilingual': { 'MO-0001': multilingualMo1, 'MO-0002': multilingualMo2 },
};

function fixtureLayaRunner(input: LayaInferenceInput): LayaRuntimeResult {
  const moId = typeof input.state === 'string' && input.state.includes('MO-0002') ? 'MO-0002' : 'MO-0001';
  const fixture = FIXTURES_BY_CHECKPOINT_AND_MO[input.checkpoint]?.[moId];
  if (!fixture) {
    return { ok: false, error: `no captured fixture for checkpoint=${input.checkpoint} moId=${moId}` };
  }
  // client.ts always asks under question id 'q' (see QUESTION_ID) - the real capture used the
  // fixture's own question id (carrier_behavior_call), so the answer is re-keyed here exactly like
  // fraud-watch-cases.test.ts's fakeLayaRunner already does, not a new convention.
  const fixtureAnswer = fixture.output.result.answers.carrier_behavior_call;
  return {
    ok: true,
    load_seconds: fixture.output.load_seconds,
    infer_seconds: fixture.output.infer_seconds,
    result: { model: fixture.output.result.model, answers: { q: fixtureAnswer }, usage: fixture.output.result.usage },
  };
}

type Event = { type: string; at: string; case_id: string; ref_id: string; detail: string; event_id: string };

let clock = Date.parse('2026-09-23T11:00:00.000Z');
function nextAt(): string {
  const iso = new Date(clock).toISOString();
  clock += 1000;
  return iso;
}

async function buildCase(moId: string, title: string) {
  const worldStatePath = process.cwd() + '/adapters/fraud-watch/__fixtures__/world-state.mos.json';
  const worldState = await readMoRecords(worldStatePath);
  if (!worldState.ok) throw new Error(worldState.error);
  const record = worldState.mos.find((m) => m.id === moId);
  if (!record) throw new Error(`no MO record ${moId} in ${worldStatePath}`);

  const caseId = `case-fraud-watch-demo-${moId}`;
  const observedAt = '2026-09-23T10:00:00.000Z';
  const behaviorResult = moRecordToBehavior(record, caseId, observedAt, worldStatePath);
  if (!behaviorResult.ok) throw new Error(behaviorResult.reason);
  const behavior: Behavior = behaviorResult.behavior;

  const events: Event[] = [];
  let evtN = 0;
  const pushEvent = (type: string, refId: string, detail: string) => {
    evtN += 1;
    events.push({ type, at: nextAt(), case_id: caseId, ref_id: refId, detail, event_id: `evt-${moId}-${evtN}` });
  };

  pushEvent(
    'BEHAVIOR_OBSERVED',
    behavior.id,
    `fraud-watch ${record.id} (classification=${record.classification}, confidenceBand=${record.confidenceBand}, noveltyScore=${record.noveltyScore}) mapped to Behavior ${behavior.id} — no fraud-watch judgment field carried into what Laya sees below.`,
  );

  const context = { swarmAvailable: false, jevAvailable: false, caseRisk: 'STANDARD' as const };
  const outcome = await evaluateBehaviorViaSystem1(
    behavior,
    ['laya-typed', 'laya-english', 'laya-multilingual'],
    context,
    { layaRunner: fixtureLayaRunner, now: () => new Date(clock).toISOString() },
  );

  if (!outcome.ok) {
    pushEvent('SYSTEM1_ROUTED', caseId, `Arena failed closed: ${outcome.reason}`);
    return { title, case_id: caseId, summary: `fraud-watch ${moId}: Arena failed closed.`, events, blocked_attempt: null };
  }

  for (const result of outcome.arena.results) {
    pushEvent(
      'MODEL_CALLED',
      result.model_id,
      `${result.model_id} (${result.checkpoint}) -> ${result.decision}` + (result.confidence !== null ? ` (confidence=${result.confidence.toFixed(4)})` : ''),
    );
  }

  const comparison = outcome.arena.comparison;
  if (comparison.agreement) {
    pushEvent(
      'ARENA_COMPARED',
      caseId,
      `${outcome.arena.results.length} independent models agreed (model_agreement_score=${comparison.model_agreement_score.toFixed(2)}).`,
    );
  } else {
    pushEvent(
      'ARENA_COMPARED',
      comparison.disagreement.id,
      `disagreement among ${comparison.disagreement.model_ids.join(', ')} (spec §35: a real signal, never averaged away).`,
    );
  }

  pushEvent(
    'SYSTEM1_ROUTED',
    caseId,
    `SHADOW recommendation: ${outcome.system1Decision.action} — ${outcome.system1Decision.rationale[0]}`,
  );

  const summary = comparison.agreement
    ? `fraud-watch ${moId}: 3 models agreed, System-1 shadow-recommends ${outcome.system1Decision.action}.`
    : `fraud-watch ${moId}: 3 models disagreed, System-1 shadow-recommends ${outcome.system1Decision.action}.`;

  return { title, case_id: caseId, summary, events, blocked_attempt: null };
}

const case1 = await buildCase('MO-0001', 'System-1 Case 1 · fraud-watch MO-0001');
const case2 = await buildCase('MO-0002', 'System-1 Case 2 · fraud-watch MO-0002');

const output = {
  generated_at: new Date().toISOString(),
  source: 'evaluation/system1-arena/fraud-watch-cases.ts, run against real fraud-watch MO-0001/MO-0002 records with a fixture-backed layaRunner replaying the real captures in adapters/model-registry/__fixtures__/PROVENANCE.md',
  note: 'decideSystem1Action() output is a SHADOW recommendation only (docs/MODEL_ARENA.md) — nothing in this repo wires System-1 into a case\'s authoritative Decision yet. swarmAvailable/jevAvailable default to false here because no real call site in this repo sets them otherwise today.',
  cases: [case1, case2],
};

mkdirSync(new URL('../data', import.meta.url), { recursive: true });
const fileContents = `// Generated by observatory/scripts/capture-system1-events.ts — do not hand-edit.\nexport default ${JSON.stringify(output, null, 2)};\n`;
writeFileSync(new URL('../data/system1-cases.js', import.meta.url), fileContents);
console.log(`Wrote observatory/data/system1-cases.js — ${output.cases.reduce((n, c) => n + c.events.length, 0)} real events across ${output.cases.length} cases.`);
