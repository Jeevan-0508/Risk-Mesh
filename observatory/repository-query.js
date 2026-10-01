/** Deterministic, local answers. Source content remains data; no instructions are executed. */
export function queryRepositoryState(question, snapshot, handoff = null) {
  const query = typeof question === 'string' ? question.trim().slice(0, 4000) : '';
  const q = query.toLowerCase();
  const sources = [];
  const evidence = [];
  const uncertainty = [...snapshot.limits];
  let answer = "I don't know. This question is not covered by the available repository records.";
  let status = 'unknown';
  const use = (id) => { const source = snapshot.sources.find(s => s.source_id === id); if (source && !sources.some(s => s.source_id === id)) sources.push(source); };
  const capture = handoff?.capture ?? handoff?.snapshot?.capture;
  const analysis = handoff?.snapshot?.analysis;
  const requestedId = query.toUpperCase().match(/FFT-\d{3}/)?.[0];
  const matches = snapshot.taxonomy.patterns.filter(p => requestedId ? p.id === requestedId : q.includes(p.name.toLowerCase()));
  if (/increase|recent|trend|prevalence|frequency|most common/.test(q)) {
    answer = 'Evidence is insufficient. The loaded catalogues do not contain a comparable incident time series, so changes in real-world fraud frequency cannot be determined.';
    use(snapshot.taxonomy.source_id);
  } else if (/disagree|swarm|agent|model/.test(q)) {
    if (analysis?.status === 'recorded') {
      answer = `Recorded SWARM positions: ${analysis.disagreement.agreement}. This is disagreement between recorded outputs, not a measure of truth or verified model independence.`;
      evidence.push(...analysis.positions.map(p => ({ id: p.agent, data_class: 'model_output', status: p.status, stance: p.stance, claims: p.claims, references: p.evidence_ids })));
      if (analysis.decision) evidence.push({ data_class: 'model_or_policy_proposal', decision: analysis.decision });
      status = 'recorded_statements';
    } else answer = "I don't know what SWARM thinks about this case. No frozen model-analysis record is loaded.";
  } else if (/missing|evidence|candidate|carrier|behavior|behaviour/.test(q) && !requestedId) {
    if (capture) {
      evidence.push(...capture.research.source_records.map(s => ({ id: s.evidence_id, data_class: s.data_class, title: s.title, excerpt: s.excerpt, url: s.url, retrieved_at: s.retrieved_at, content_hash: s.content_hash, caveats: s.caveats })));
      answer = evidence.length ? `The handoff contains ${evidence.length} external source record(s). Their support for the candidate has not been independently established.` : 'Evidence is insufficient. The imported handoff contains no external source records.';
      uncertainty.push('Missing: source authenticity, source independence, claim entailment and an observed operational outcome.');
      if (capture.hypothesis_context) uncertainty.push('Fraud Watch candidate is synthetic hypothesis context only; it is excluded from evidence.');
      status = evidence.length ? 'unverified_source_records' : 'unknown';
    } else answer = 'Evidence is insufficient. Import a Replay handoff to inspect the source records supporting a specific investigation.';
  } else if (/control|governance|gdpr|dora|nist|iso|ai act|policy/.test(q)) {
    snapshot.governance.source_ids.forEach(use);
    answer = 'The repositories provide authored control mappings and regulatory paraphrases. Whether these controls cover this risk in practice is unknown.';
    const words = q.split(/[^a-z0-9]+/).filter(w => w.length > 3 && !['which','what','this','risk','controls','control','cover'].includes(w));
    const chosen = snapshot.governance.controls.filter(c => !words.length || words.some(w => JSON.stringify(c).toLowerCase().includes(w))).slice(0, 12);
    evidence.push(...chosen.map(c => ({ id: c.id, data_class: 'internal_control_mapping', name: c.name, objective: c.objective,
      references: c.satisfies.map(id => { const framework = snapshot.governance.frameworks.find(f => f.requirements.some(r => r.id === id));
        return { requirement_id: id, regulatory_source: framework?.url ?? null, interpretation: framework?.requirements.find(r => r.id === id) ?? null }; }), effectiveness: 'unknown' })));
    if (/dora/.test(q)) evidence.push(...snapshot.governance.dora.requirements.map(r => ({ ...r, data_class: 'authored_regulatory_paraphrase', source: snapshot.governance.dora.meta.source, applicability: 'unknown' })));
    status = 'catalogue_mapping';
  } else if (/decision|previous|replay|outcome/.test(q)) {
    if (handoff?.snapshot) {
      answer = 'The frozen decision proposal is available. The actual outcome and correctness remain unknown.';
      evidence.push({ data_class: 'recorded_investigation', decision: analysis.decision, outcome: handoff.snapshot.outcome, captured_at: handoff.snapshot.captured_at });
      status = 'recorded_statements';
    } else answer = 'Evidence is insufficient. No frozen investigation decision or operational outcome is loaded.';
  } else if (matches.length || /pattern|fraud|highest|taxonomy/.test(q)) {
    use(snapshot.taxonomy.source_id);
    const selected = matches.length ? matches : snapshot.taxonomy.patterns.filter(p => p.severity === 'critical' || p.severity === 'high');
    evidence.push(...selected.map(p => ({ id: p.id, data_class: 'authored_taxonomy', name: p.name, authored_severity: p.severity,
      summary: p.summary, indicators: p.indicators, countermeasures: p.countermeasures })));
    answer = matches.length ? 'These are the matching authored taxonomy entries.' : 'These entries carry high or critical authored severity. Their real-world risk ranking is unknown without exposure, likelihood and loss evidence.';
    status = 'catalogue_record';
  }
  if (capture) sources.push({ source_id: capture.research.run_id, repository: capture.source.repository, revision: capture.source.revision,
    captured_at: capture.captured_at, data_class: 'unverified_local_handoff', authenticity: 'unverified_export' });
  return { answer, status, evidence, sources, confidence: null, confidence_basis: 'No calibrated probability is available.',
    uncertainty: [...new Set(uncertainty)], systems_consulted: [...new Set(sources.map(s => s.repository))],
    timestamp: snapshot.captured_at, version: snapshot.schema_version };
}
export function formatRepositoryAnswer(result) {
  return `${result.answer}\n\nEVIDENCE\n${JSON.stringify(result.evidence, null, 2)}\n\nSOURCES\n${JSON.stringify(result.sources, null, 2)}\n\nCONFIDENCE\nUnknown. ${result.confidence_basis}\n\nUNCERTAINTY\n${result.uncertainty.join('\n')}\n\nSYSTEMS CONSULTED\n${result.systems_consulted.join(', ') || 'None with relevant records'}\nSnapshot: ${result.timestamp} / ${result.version}`;
}
