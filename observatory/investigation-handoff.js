/* Consumer-side guard for risk-replay-investigation-handoff.v1.
 * This is intentionally dependency-free so the Observatory can validate a downloaded file
 * before it reaches a provider. It reconstructs no current knowledge and never treats the
 * synthetic Fraud Watch context as evidence. */
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, fields) => isObject(v) && Object.keys(v).length === fields.length && fields.every((f) => Object.hasOwn(v, f));
const text = (v, max = 20000) => typeof v === 'string' && v.length <= max;
const ids = (v) => Array.isArray(v) && v.length <= 500 && v.every((x) => text(x, 300)) && new Set(v).size === v.length;
const date = (v) => text(v, 80) && Number.isFinite(Date.parse(v));
const fail = (error) => ({ ok: false, error });

export function validateInvestigationHandoff(value) {
  try {
    const json = JSON.stringify(value);
    if (json.length > 2_000_000) return fail('Investigation handoff exceeds 2 MB.');
    if (!exact(value, ['schema_version', 'kind', 'created_at', 'review_state', 'replay_status', 'snapshot', 'reconstruction']) ||
      value.schema_version !== 'risk-replay-investigation-handoff.v1' || value.kind !== 'risk_replay_investigation_handoff' ||
      !date(value.created_at) || value.review_state !== 'unreviewed' || value.replay_status !== 'frozen_context_reconstructed') return fail('Unsupported investigation handoff version or state.');
    const s = value.snapshot;
    if (!exact(s, ['schema_version', 'kind', 'captured_at', 'capture', 'analysis', 'outcome', 'unknowns', 'knowledge_promotion']) ||
      s.schema_version !== 'swarm-investigation-snapshot.v1' || s.kind !== 'risk_swarm_investigation_snapshot' || !date(s.captured_at) ||
      Date.parse(value.created_at) < Date.parse(s.captured_at) || !ids(s.unknowns) || s.knowledge_promotion !== 'prohibited') return fail('Frozen investigation envelope is malformed.');
    const c = s.capture;
    if (!exact(c, ['schema_version', 'kind', 'captured_at', 'source', 'research', 'hypothesis_context', 'excluded_outputs', 'integrity_note']) ||
      c.schema_version !== 'swarm-research-capture.v1' || c.kind !== 'risk_swarm_research_capture' || !date(c.captured_at) ||
      !isObject(c.source) || c.source.repository !== 'Jeevan-0508/risk-swarm' || !(c.source.revision === null || /^[a-f0-9]{40}$/.test(c.source.revision))) return fail('Nested SWARM capture provenance is malformed.');
    const r = c.research;
    if (!exact(r, ['run_id', 'question', 'question_origin', 'started_at', 'retrieval_status', 'attempts', 'source_records', 'dropped_sources', 'internal_search']) ||
      !text(r.run_id, 300) || !text(r.question, 4000) || r.question_origin !== 'operator_supplied' || !date(r.started_at) ||
      !['ok', 'partial', 'search_failed', 'limit_reached'].includes(r.retrieval_status) || !Array.isArray(r.source_records)) return fail('Research capture is malformed.');
    const sourceIds = new Set();
    for (const source of r.source_records) {
      if (!exact(source, ['evidence_id', 'data_class', 'role', 'provider', 'source_identity', 'source_type', 'query', 'url', 'title', 'excerpt', 'content_hash', 'content_hash_algorithm', 'retrieved_at', 'stated_date', 'date_kind', 'via_proxy', 'caveats', 'injection_suspected']) ||
        source.data_class !== 'external_source_content' || source.role !== 'retrieved_source_record' || !text(source.evidence_id, 300) || sourceIds.has(source.evidence_id) ||
        !text(source.title, 20000) || !text(source.excerpt, 20000) || !date(source.retrieved_at) || !['sha256', 'fnv1a'].includes(source.content_hash_algorithm) ||
        !Array.isArray(source.caveats) || !source.caveats.every((x) => text(x, 1000)) || typeof source.injection_suspected !== 'boolean') return fail('Synthetic, malformed or duplicated source record found.');
      try { const u = new URL(source.url); if (!['http:', 'https:'].includes(u.protocol)) return fail('Source record URL must be HTTP(S).'); } catch { return fail('Source record URL is invalid.'); }
      sourceIds.add(source.evidence_id);
    }
    const a = s.analysis;
    if (!exact(a, ['status', 'selected_source_ids', 'omitted_source_ids', 'positions', 'disagreement', 'decision', 'trace']) || !['recorded', 'not_run'].includes(a.status) || !ids(a.selected_source_ids) || !ids(a.omitted_source_ids) ||
      a.selected_source_ids.some((id) => !sourceIds.has(id)) || a.omitted_source_ids.some((id) => sourceIds.has(id))) return fail('Analysis source references are invalid.');
    if (a.positions.some((p) => !isObject(p) || p.status === 'independent' && p.evidence_ids.some((id) => !sourceIds.has(id)))) return fail('Model position cites unavailable or synthetic evidence.');
    if (a.decision && (!isObject(a.decision) || a.decision.data_class !== 'model_or_policy_proposal' || !['proposed', 'abstained'].includes(a.decision.state))) return fail('Decision is not a proposal-only record.');
    if (!exact(s.outcome, ['status', 'correctness', 'record']) || s.outcome.status !== 'not_observed' || s.outcome.correctness !== 'unknown' || s.outcome.record !== null) return fail('Outcome correctness cannot be manufactured.');
    if (c.hypothesis_context !== null && (!isObject(c.hypothesis_context) || c.hypothesis_context.data_class !== 'synthetic_simulation' || c.hypothesis_context.role !== 'hypothesis_context_only')) return fail('Synthetic context boundary is malformed.');
    return { ok: true, handoff: value };
  } catch { return fail('Could not parse the investigation handoff safely.'); }
}

export function buildInvestigationContext(handoff) {
  const checked = validateInvestigationHandoff(handoff);
  if (!checked.ok) throw new Error(checked.error);
  const s = checked.handoff.snapshot; const c = s.capture;
  return [
    'Frozen SWARM investigation; replay_status=frozen_context_reconstructed; review_state=unreviewed.',
    `Question: ${JSON.stringify(c.research.question)}`,
    `Analysis status: ${s.analysis.status}; selected sources: ${s.analysis.selected_source_ids.join(', ') || 'none'}.`,
    ...c.research.source_records.map((source) => JSON.stringify({ data_class: source.data_class, evidence_id: source.evidence_id, title: source.title, excerpt: source.excerpt, url: source.url, caveats: source.caveats })),
    c.hypothesis_context ? 'Synthetic Fraud Watch context is present as hypothesis only; it is excluded from evidence.' : 'No synthetic hypothesis context was attached.',
    'Outcome: not observed; correctness: unknown; knowledge promotion: prohibited.',
  ].join('\n');
}
