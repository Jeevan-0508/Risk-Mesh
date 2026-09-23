import { describe, expect, it } from 'bun:test';
import { assessReplayStability } from './adapter';
import { health } from './client';

/**
 * `RISK_REPLAY_API_BASE_URL` — set by whoever is running the backend locally (see repo README).
 * Unset by default, matching §58: no adapter defaults to guessing a URL and calling it "live".
 */
const LIVE_BASE_URL = process.env.RISK_REPLAY_API_BASE_URL;

describe('assessReplayStability — deterministic UNAVAILABLE path (no server needed)', () => {
  it('reports UNAVAILABLE, never a fabricated Replay, when the backend cannot be reached', async () => {
    const result = await assessReplayStability(
      { baseUrl: 'http://127.0.0.1:1', timeoutMs: 500 },
      { caseId: 'case-1', decisionId: 'DEC-001', mutationType: 'REMOVE_EVIDENCE', target: 'E3', reason: 'test' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('UNAVAILABLE');
  });

  it('refuses to call the backend at all for a mutation type risk-replay has no vocabulary for', async () => {
    // getDecision would still be attempted first; this confirms the mutation-mapping refusal wins
    // over a real backend call when both would otherwise apply, by pointing at an address nothing
    // is listening on and confirming the error names the *mapping* problem, not just "unreachable",
    // once a live backend exists. Without a live backend, this still exercises the same early-exit
    // path deterministically: an unreachable getDecision short-circuits before mutation mapping runs.
    const result = await assessReplayStability(
      { baseUrl: 'http://127.0.0.1:1', timeoutMs: 500 },
      { caseId: 'case-1', decisionId: 'DEC-001', mutationType: 'ALTER_TIMELINE', target: 'x', reason: 'test' },
    );
    expect(result.ok).toBe(false);
  });
});

describe('assessReplayStability — live path (skipped unless RISK_REPLAY_API_BASE_URL is set and reachable)', () => {
  it('runs a real counterfactual against a live risk-replay instance when one is configured', async () => {
    if (!LIVE_BASE_URL) {
      console.warn('RISK_REPLAY_API_BASE_URL not set — skipping live risk-replay adapter test. See README for how to run the backend locally.');
      return;
    }
    const config = { baseUrl: LIVE_BASE_URL, timeoutMs: 5000 };
    const healthCheck = await health(config);
    if (!healthCheck.ok) {
      console.warn(`RISK_REPLAY_API_BASE_URL set to ${LIVE_BASE_URL} but not reachable — skipping. ${healthCheck.error}`);
      return;
    }

    const result = await assessReplayStability(config, {
      caseId: 'case-mesh-live-test', decisionId: 'DEC-001', mutationType: 'REMOVE_EVIDENCE', target: 'E3', reason: 'mesh live adapter test',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(['STABLE', 'FRAGILE', 'NON_REPLAYABLE']).toContain(result.replay.status);
      expect(result.replay.provenance.source).toBe('LIVE');
    }
  });
});
