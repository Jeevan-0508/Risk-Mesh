import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MESH_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_PATH = path.join(MESH_ROOT, 'data', 'briefing-state.json');
const PUBLIC_PATH = path.join(MESH_ROOT, 'observatory', 'data', 'briefing.js');
const OWNER = 'Jeevan-0508';
const BRIEFING_SCHEMA_VERSION = '1.2';

export const SOURCE_DEFINITIONS = [
  {
    id: 'fomo', name: 'FOMO', repo: 'FOMO', status: 'SNAPSHOT', sourceType: 'REAL_WORLD', evidenceType: 'EXTERNAL_SOURCE',
    trust: 'External freight/logistics signals discovered from Google News RSS; the checked artifact is a repository snapshot, not a live browser connection.',
    files: [{ path: 'data/signals.json', format: 'json' }],
    capabilities: ['new external freight-risk signals', 'source titles and links'],
  },
  {
    id: 'fraud-watch', name: 'Fraud Watch', repo: 'fraud-watch', status: 'SIMULATED', sourceType: 'SYNTHETIC', evidenceType: 'SIMULATION',
    trust: 'Deterministic freight-fraud simulation. Its MOs and candidate patterns are not real incidents.',
    files: [
      { path: 'data/dashboard-summary.json', format: 'json' },
      { path: 'data/world-state.json', format: 'json' },
    ],
    capabilities: ['synthetic MO and candidate counts', 'simulation freshness and state'],
  },
  {
    id: 'shadow-network', name: 'Shadow Network', repo: 'shadow-network', status: 'SIMULATED', sourceType: 'SYNTHETIC', evidenceType: 'SIMULATION',
    trust: 'Deterministic synthetic carrier-network state. It does not observe real carriers or real incidents.',
    files: [{ path: 'data/latest.json', format: 'json' }],
    capabilities: ['synthetic day, incidents and verdicts', 'carrier-network snapshot'],
  },
  {
    id: 'eu-ai-act-scanner', name: 'EU AI Act Scanner', repo: 'eu-ai-act-scanner', status: 'OFFICIAL', sourceType: 'OFFICIAL', evidenceType: 'OFFICIAL_SOURCE',
    trust: 'Official-source monitoring only. A changed hash means human review is required; it does not rewrite compliance rules.',
    files: [
      { path: 'data/regulatory-monitor.json', format: 'json' },
      { path: 'data/regulatory-changes.jsonl', format: 'jsonl' },
    ],
    capabilities: ['official source check status', 'review-required regulatory hashes'],
  },
  {
    id: 'risk-ring', name: 'Risk Ring', repo: 'risk-ring', status: 'SIMULATED', sourceType: 'SYNTHETIC', evidenceType: 'SIMULATION',
    trust: 'Deterministic synthetic financial-crime network analysis. It is not connected to live financial data.',
    files: [
      { path: 'data/alerts.json', format: 'json' },
      { path: 'data/rings.json', format: 'json' },
      { path: 'data/metrics.json', format: 'json' },
      { path: 'data/graph_metrics.json', format: 'json' },
    ],
    capabilities: ['synthetic alerts and rings', 'model and graph metrics'],
  },
  {
    id: 'forecast-ledger', name: 'Forecast Ledger', repo: 'Forecast-Ledger', status: 'OFFICIAL', sourceType: 'OFFICIAL_DATA', evidenceType: 'OFFICIAL_SOURCE',
    trust: 'Uses public Eurostat data and deterministic eligibility/grading rules. Refusals are preserved as refusals.',
    files: [{ path: 'site/data.json', format: 'json' }],
    capabilities: ['sealed and graded forecast counts', 'explicit eligibility refusals'],
  },
  {
    id: 'reg-search', name: 'Reg Search', repo: 'reg-search', status: 'SNAPSHOT', sourceType: 'SNAPSHOT', evidenceType: 'OFFICIAL_CITATION',
    trust: 'A provenance-recorded snapshot of cited regulatory requirements. It preserves official URLs and does not generate legal text.',
    files: [
      { path: 'data/source-provenance.json', format: 'json' },
      { path: 'data/source-history.jsonl', format: 'jsonl' },
    ],
    capabilities: ['upstream requirement count and hash', 'official citation availability'],
  },
];

function hash(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value)).digest('hex');
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function rawUrl(repo, filePath) {
  return `https://raw.githubusercontent.com/${OWNER}/${repo}/main/${filePath}`;
}

function repoUrl(repo, filePath = '') {
  return `https://github.com/${OWNER}/${repo}/blob/main/${filePath}`;
}

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

async function readArtifact(def, file) {
  const roots = [];
  if (process.env.MESH_SOURCE_ROOT) roots.push(path.join(process.env.MESH_SOURCE_ROOT, def.repo));
  roots.push(path.resolve(MESH_ROOT, '..', def.repo));
  for (const root of roots) {
    const localPath = path.join(root, file.path);
    if (await exists(localPath)) {
      const content = await readFile(localPath, 'utf8');
      return { content, origin: 'local', url: repoUrl(def.repo, file.path) };
    }
  }
  const response = await fetch(rawUrl(def.repo, file.path), { headers: { accept: 'application/json, text/plain' } });
  if (!response.ok) throw new Error(`${file.path}: HTTP ${response.status}`);
  return { content: await response.text(), origin: 'github', url: rawUrl(def.repo, file.path) };
}

function parseArtifact(content, format) {
  if (format === 'json') return JSON.parse(content);
  return content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function loadSource(def) {
  const artifacts = {};
  const origins = new Set();
  const urls = [];
  for (const file of def.files) {
    const loaded = await readArtifact(def, file);
    artifacts[file.path] = parseArtifact(loaded.content, file.format);
    origins.add(loaded.origin);
    urls.push(loaded.url);
  }
  return { artifacts, origins: [...origins], urls, fingerprint: hash(Object.fromEntries(Object.entries(artifacts))) };
}

function isoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function link(label, url) { return { label, url }; }

function baseSource(def, loaded, retrievedAt, sourceTimestamp = null) {
  return {
    id: def.id,
    name: def.name,
    repo: def.repo,
    status: def.status,
    sourceType: def.sourceType,
    evidenceType: def.evidenceType,
    trust: def.trust,
    capabilities: def.capabilities,
    retrievedAt,
    sourceTimestamp,
    freshness: sourceTimestamp ? `source timestamp ${sourceTimestamp}` : 'timestamp not supplied by source',
    sourceUrls: loaded.urls,
    origin: loaded.origins.includes('local') ? 'local checkout' : 'GitHub raw snapshot',
  };
}

export function recordDiff(previousRecords = {}, currentRecords = {}) {
  const added = Object.keys(currentRecords).filter((id) => !previousRecords[id]);
  const updated = Object.keys(currentRecords).filter((id) => previousRecords[id] && previousRecords[id] !== currentRecords[id]);
  return { added, updated, changed: [...added, ...updated] };
}

function sourceRecord(id, value) { return { id, hash: hash(value) }; }

function updateFor(def, source, changed, title, summary, details, extra = {}) {
  return {
    id: `${def.id}:briefing`,
    sourceProject: def.name,
    timestamp: extra.timestamp || source.retrievedAt,
    title,
    summary,
    category: extra.category || 'risk-intelligence',
    importance: extra.importance || 'medium',
    evidenceType: def.evidenceType,
    sourceType: def.sourceType,
    links: [link(`Open ${def.name} repository output`, repoUrl(def.repo)), ...(extra.links || [])],
    provenance: {
      sourceProject: def.name,
      sourceFiles: def.files.map((file) => file.path),
      sourceUrls: source.sourceUrls,
      retrievedAt: source.retrievedAt,
      contentHash: source.fingerprint,
      status: def.status,
      origin: source.origin,
      freshness: source.freshness,
      changedRecords: changed,
    },
    details,
    status: extra.status || (changed.length ? 'NEW' : 'UNCHANGED'),
    fingerprint: source.fingerprint,
  };
}

function normalizeFomo(def, loaded, previous, retrievedAt, previousUpdate) {
  const data = loaded.artifacts['data/signals.json'];
  const records = Array.isArray(data?.signals) ? data.signals : [];
  const recordMap = Object.fromEntries(records.map((record) => [record.link || `${record.title}:${record.pub_date}`, hash(record)]));
  const diff = recordDiff(previous?.records, recordMap);
  const source = baseSource(def, loaded, retrievedAt, records.map((r) => isoOrNull(r.pub_date)).filter(Boolean).sort().at(-1) || null);
  source.recordCount = records.length;
  const displayRecords = records.slice().sort((a, b) => String(b.found_at || b.pub_date).localeCompare(String(a.found_at || a.pub_date)));
  const normalizedRecords = displayRecords.map((record) => ({
    id: record.link || `${record.title}:${record.pub_date}`,
    title: record.title || 'Untitled FOMO report',
    summary: typeof record.summary === 'string' ? record.summary : null,
    timestamp: isoOrNull(record.pub_date) || isoOrNull(record.found_at),
    foundAt: isoOrNull(record.found_at),
    location: typeof record.location === 'string' ? record.location : null,
    category: typeof record.category === 'string' ? record.category : null,
    severity: typeof record.severity === 'string' ? record.severity : null,
    source: typeof record.source === 'string' ? record.source : null,
    links: record.link ? [link('Open original source', record.link)] : [],
    classification: 'REAL_WORLD_SIGNAL',
  }));
  const needsRecordMigration = !Array.isArray(previousUpdate?.details?.records) || previousUpdate.details.records.length !== records.length;
  const currentChanged = loaded.fingerprint !== previous?.fingerprint;
  const update = currentChanged || needsRecordMigration
    ? updateFor(def, source, diff.changed, currentChanged && diff.added.length ? 'New external freight-risk signals' : currentChanged ? 'FOMO signal snapshot updated' : 'FOMO report archive ready', currentChanged ? `${diff.added.length} new and ${diff.updated.length} updated external freight-risk report${diff.added.length + diff.updated.length === 1 ? '' : 's'} detected.` : `${records.length} FOMO reports are available in the checked snapshot.`, {
      recordCount: records.length,
      newCount: diff.added.length,
      updatedCount: diff.updated.length,
      records: normalizedRecords,
    }, { importance: records.some((r) => r.severity === 'high') ? 'high' : 'medium', status: currentChanged ? undefined : 'UPDATED', links: [link('Open FOMO data', repoUrl(def.repo, 'data/signals.json'))] })
    : null;
  return { source, records: recordMap, update };
}

function extractFraudMos(worldState) {
  const pairs = Array.isArray(worldState?.moEngine?.mos) ? worldState.moEngine.mos : [];
  return pairs.map((pair) => Array.isArray(pair) ? pair[1] : pair?.value).filter(Boolean);
}

function normalizeFraudWatch(def, loaded, previous, retrievedAt, previousUpdate) {
  const summary = loaded.artifacts['data/dashboard-summary.json'];
  const world = loaded.artifacts['data/world-state.json'];
  const mos = extractFraudMos(world);
  const candidates = Array.isArray(summary?.candidateExports?.candidates) ? summary.candidateExports.candidates : [];
  const records = Object.fromEntries([
    ...mos.map((mo) => [mo.id, hash({ id: mo.id, status: mo.status, classification: mo.classification, signature: mo.signature, lastObserved: mo.lastObserved })]),
    ...candidates.map((candidate) => [candidate.id, hash(candidate)]),
  ]);
  const diff = recordDiff(previous?.records, records);
  const sourceTimestamp = summary?.simulation?.absSeconds != null ? `simulation day ${summary.simulation.day}, ${summary.simulation.timeOfDay}` : null;
  const source = baseSource(def, loaded, retrievedAt, sourceTimestamp);
  source.recordCount = Object.keys(records).length;
  source.simulationDay = summary?.simulation?.day ?? world?.clock?.day ?? null;
  const currentChanged = loaded.fingerprint !== previous?.fingerprint;
  const update = currentChanged || !previousUpdate
    ? updateFor(def, source, diff.changed, 'Fraud Watch simulation state changed', `Synthetic simulation day ${source.simulationDay ?? 'unknown'} contains ${candidates.length} candidate method${candidates.length === 1 ? '' : 's'} of operation and ${summary?.world?.openInvestigations ?? 'an unknown number of'} open investigation${summary?.world?.openInvestigations === 1 ? '' : 's'}.`, {
      simulation: { day: source.simulationDay, timeOfDay: summary?.simulation?.timeOfDay || null, activeSignals: summary?.world?.activeSignals ?? null, openInvestigations: summary?.world?.openInvestigations ?? null, totalCases: summary?.world?.totalCases ?? null },
      candidates,
      methods: mos.slice(-12).map((mo) => ({ id: mo.id, status: mo.status, classification: mo.classification, confidenceBand: mo.confidenceBand, noveltyScore: mo.noveltyScore, signature: mo.signature, entities: mo.entities, timeline: mo.timeline, evidence: mo.evidence })),
      label: 'SYNTHETIC SIMULATION — not real-world fraud cases',
    }, { importance: candidates.length ? 'medium' : 'low', links: [link('Open Fraud Watch state', repoUrl(def.repo, 'data/world-state.json')), link('Open simulation report', repoUrl(def.repo, 'data/dashboard-summary.json'))] })
    : null;
  return { source, records, update };
}

function normalizeShadow(def, loaded, previous, retrievedAt, previousUpdate) {
  const data = loaded.artifacts['data/latest.json'];
  const records = { snapshot: hash({ day: data?.day, generatedAt: data?.generatedAt, incidents: data?.todaysIncidents, verdicts: data?.todaysVerdicts, relationships: data?.relationships }) };
  const diff = recordDiff(previous?.records, records);
  const source = baseSource(def, loaded, retrievedAt, isoOrNull(data?.generatedAt));
  source.recordCount = 1;
  source.simulationDay = data?.day ?? null;
  const incidents = Array.isArray(data?.todaysIncidents) ? data.todaysIncidents : [];
  const verdicts = Array.isArray(data?.todaysVerdicts) ? data.todaysVerdicts : [];
  const update = loaded.fingerprint !== previous?.fingerprint || !previousUpdate
    ? updateFor(def, source, diff.changed, 'Shadow Network synthetic snapshot changed', `Synthetic network day ${data?.day ?? 'unknown'} was refreshed: ${incidents.length} incident${incidents.length === 1 ? '' : 's'} and ${verdicts.length} verdict${verdicts.length === 1 ? '' : 's'} are recorded in the latest state.`, {
      day: data?.day,
      generatedAt: data?.generatedAt,
      incidents,
      verdicts,
      carrierCount: Array.isArray(data?.carriers) ? data.carriers.length : null,
      relationshipCount: Array.isArray(data?.relationships) ? data.relationships.length : null,
      label: 'SYNTHETIC SIMULATION — not real carrier-network intelligence',
    }, { importance: incidents.length || verdicts.length ? 'medium' : 'low', links: [link('Open Shadow Network snapshot', repoUrl(def.repo, 'data/latest.json'))] })
    : null;
  return { source, records, update };
}

function normalizeEu(def, loaded, previous, retrievedAt, previousUpdate) {
  const monitor = loaded.artifacts['data/regulatory-monitor.json'];
  const changes = loaded.artifacts['data/regulatory-changes.jsonl'];
  const records = Object.fromEntries((Array.isArray(monitor?.sources) ? monitor.sources : []).map((item) => [item.id, hash({ hash: item.content_hash, status: item.review_status, http: item.http_status })]));
  const diff = recordDiff(previous?.records, records);
  const source = baseSource(def, loaded, retrievedAt, isoOrNull(monitor?.checked_at));
  source.recordCount = Object.keys(records).length;
  source.reviewRequired = Array.isArray(changes) ? changes.length : 0;
  const update = loaded.fingerprint !== previous?.fingerprint || !previousUpdate
    ? updateFor(def, source, diff.changed, 'Official EU AI monitoring completed', `${Array.isArray(changes) ? changes.length : 0} official source change record${changes?.length === 1 ? '' : 's'} require human review. No compliance rule was rewritten by MESH.`, {
      sources: Array.isArray(monitor?.sources) ? monitor.sources.map((item) => ({ id: item.id, title: item.title, url: item.url, status: item.review_status, httpStatus: item.http_status, contentHash: item.content_hash, retrievedAt: item.retrieved_at })) : [],
      changes,
      label: 'OFFICIAL SOURCE MONITOR — REVIEW_REQUIRED is not a legal conclusion',
    }, { importance: changes?.length ? 'high' : 'low', links: (monitor?.sources || []).map((item) => link(item.title, item.url)) })
    : null;
  return { source, records, update };
}

function normalizeRiskRing(def, loaded, previous, retrievedAt, previousUpdate) {
  const alerts = loaded.artifacts['data/alerts.json'];
  const rings = loaded.artifacts['data/rings.json'];
  const metrics = loaded.artifacts['data/metrics.json'];
  const graph = loaded.artifacts['data/graph_metrics.json'];
  const records = { analysis: hash({ alerts, rings, metrics, graph }) };
  const diff = recordDiff(previous?.records, records);
  const source = baseSource(def, loaded, retrievedAt, null);
  source.recordCount = (Array.isArray(alerts) ? alerts.length : 0) + (Array.isArray(rings) ? rings.length : 0);
  const update = loaded.fingerprint !== previous?.fingerprint || !previousUpdate
    ? updateFor(def, source, diff.changed, 'Risk Ring synthetic analysis changed', `Synthetic analysis contains ${alerts?.length || 0} alerts across ${rings?.length || 0} rings; graph recovery covers ${graph?.rings_recovered_ge_30pct ?? 'an unknown number'} of ${graph?.total_true_rings ?? 'an unknown number'} synthetic rings.`, {
      metrics,
      graphMetrics: graph,
      alerts: (alerts || []).slice(0, 12),
      rings: (rings || []).slice(0, 8),
      label: 'SYNTHETIC ANALYSIS — not live financial intelligence',
    }, { importance: alerts?.length ? 'medium' : 'low', links: [link('Open Risk Ring alerts', repoUrl(def.repo, 'data/alerts.json')), link('Open Risk Ring metrics', repoUrl(def.repo, 'data/graph_metrics.json'))] })
    : null;
  return { source, records, update };
}

function normalizeForecast(def, loaded, previous, retrievedAt, previousUpdate) {
  const data = loaded.artifacts['site/data.json'];
  const records = { ledger: hash({ profile: data?.data_profile, series: data?.series, backtests: data?.backtests, ledger: data?.ledger, refusals: data?.refusals, integrity: data?.integrity }) };
  const diff = recordDiff(previous?.records, records);
  const source = baseSource(def, loaded, retrievedAt, data?.data_profile?.series?.map((s) => s.dataset_updated).sort().at(-1) || null);
  source.recordCount = Array.isArray(data?.ledger) ? data.ledger.length : 0;
  const counts = data?.counts || {};
  const update = loaded.fingerprint !== previous?.fingerprint || !previousUpdate
    ? updateFor(def, source, diff.changed, 'Forecast Ledger refresh completed', `${counts.sealed || 0} forecast${counts.sealed === 1 ? '' : 's'} sealed, ${counts.graded || 0} graded, and ${counts.refused || 0} explicitly refused by the eligibility rules.`, {
      counts,
      integrity: data?.integrity,
      refusals: data?.refusals,
      series: Object.values(data?.series || {}).map((series) => ({ dataset: series.dataset, seriesId: series.series_id, role: series.role, lastObservation: series.last_observation, fetchedAt: series.fetched_at })),
      label: 'OFFICIAL PUBLIC DATA + DETERMINISTIC LEDGER — refusal is not a forecast',
    }, { importance: counts.refused ? 'medium' : 'low', links: [link('Open Forecast Ledger data', repoUrl(def.repo, 'site/data.json')), link('Open Forecast Ledger methodology', repoUrl(def.repo, 'METHODOLOGY.md'))] })
    : null;
  return { source, records, update };
}

function normalizeRegSearch(def, loaded, previous, retrievedAt, previousUpdate) {
  const provenance = loaded.artifacts['data/source-provenance.json'];
  const history = loaded.artifacts['data/source-history.jsonl'];
  const records = { upstream: hash({ contentHash: provenance?.content_hash, requirementCount: provenance?.requirement_count, officialSources: provenance?.official_sources }) };
  const diff = recordDiff(previous?.records, records);
  const source = baseSource(def, loaded, retrievedAt, isoOrNull(provenance?.retrieved_at));
  source.recordCount = provenance?.requirement_count || 0;
  source.officialSources = provenance?.official_sources || [];
  const warnings = (provenance?.official_sources || []).filter((item) => item.availability !== 'OK');
  const update = loaded.fingerprint !== previous?.fingerprint || !previousUpdate
    ? updateFor(def, source, diff.changed, 'Reg Search citation snapshot changed', `${provenance?.requirement_count || 0} cited requirements are available from the recorded upstream snapshot${warnings.length ? `; ${warnings.length} official citation check${warnings.length === 1 ? '' : 's'} need attention` : ''}.`, {
      upstreamRepository: provenance?.upstream_repository,
      upstreamUrl: provenance?.upstream_url,
      contentHash: provenance?.content_hash,
      requirementCount: provenance?.requirement_count,
      officialSources: provenance?.official_sources,
      history,
      label: 'SNAPSHOT OF CITED OFFICIAL SOURCES — not legal advice',
    }, { importance: warnings.length ? 'medium' : 'low', links: [link('Open Reg Search requirements', repoUrl(def.repo, 'src/data.js')), link('Open source provenance', repoUrl(def.repo, 'data/source-provenance.json'))] })
    : null;
  return { source, records, update };
}

const NORMALIZERS = {
  fomo: normalizeFomo,
  'fraud-watch': normalizeFraudWatch,
  'shadow-network': normalizeShadow,
  'eu-ai-act-scanner': normalizeEu,
  'risk-ring': normalizeRiskRing,
  'forecast-ledger': normalizeForecast,
  'reg-search': normalizeRegSearch,
};

function publicSource(source) {
  const { records, fingerprint, ...rest } = source;
  return rest;
}

function readPrevious() {
  return readFile(STATE_PATH, 'utf8').then((raw) => {
    const parsed = JSON.parse(raw);
    return parsed.schema_version === BRIEFING_SCHEMA_VERSION ? parsed : { schema_version: BRIEFING_SCHEMA_VERSION, sourceStates: {} };
  }).catch(() => ({ schema_version: BRIEFING_SCHEMA_VERSION, sourceStates: {} }));
}

function publicPayload(generatedAt, sources, updates) {
  return {
    schema_version: BRIEFING_SCHEMA_VERSION,
    generatedAt,
    headline: updates.length ? `Good morning, Jeevan. ${updates.length} source update${updates.length === 1 ? ' is' : 's are'} ready.` : 'Good morning, Jeevan. No new source updates were recorded in the latest completed check.',
    sources: sources.map(publicSource),
    updates,
    capabilities: {
      conversation: 'DETERMINISTIC_LOCAL',
      localAI: 'OPTIONAL_LAZY',
      localSTT: 'OPTIONAL_LAZY',
      customVoice: 'ARCHITECTURE_READY_PRIVATE_BACKEND_REQUIRED',
      voiceInput: 'BROWSER_OPTIONAL',
      voiceOutput: 'BROWSER_OPTIONAL',
      laya: 'UNAVAILABLE',
      jev: 'UNAVAILABLE',
      swarm: 'UNAVAILABLE',
    },
  };
}

export async function buildBriefing({ now = new Date().toISOString() } = {}) {
  const previous = await readPrevious();
  const sources = [];
  const sourceStates = {};
  const updates = [];
  for (const def of SOURCE_DEFINITIONS) {
    const prior = previous.sourceStates?.[def.id];
    try {
      const loaded = await loadSource(def);
      const previousUpdate = previous.payload?.updates?.find((update) => update.sourceProject === def.name);
      const normalized = NORMALIZERS[def.id](def, loaded, prior, now, previousUpdate);
      const sourceState = {
        ...normalized.source,
        fingerprint: loaded.fingerprint,
        records: normalized.records,
        retrievedAt: loaded.fingerprint === prior?.fingerprint && prior?.retrievedAt ? prior.retrievedAt : now,
        status: 'AVAILABLE',
        error: null,
      };
      sourceState.freshness = sourceState.sourceTimestamp ? `source timestamp ${sourceState.sourceTimestamp}; checked ${sourceState.retrievedAt}` : `checked ${sourceState.retrievedAt}`;
      sources.push(sourceState);
      sourceStates[def.id] = sourceState;
      if (normalized.update) updates.push(normalized.update);
    } catch (error) {
      const sourceState = {
        ...(prior || baseSource(def, { urls: [rawUrl(def.repo, def.files[0].path)], origin: 'unknown' }, now)),
        status: 'UNAVAILABLE',
        error: error instanceof Error ? error.message : String(error),
        retrievedAt: prior?.retrievedAt || now,
        freshness: prior?.retrievedAt ? `last successful check ${prior.retrievedAt}; latest check failed` : 'latest check failed; no successful snapshot available',
      };
      sources.push(sourceState);
      sourceStates[def.id] = sourceState;
      updates.push({
        id: `${def.id}:unavailable:${hash(sourceState.error)}`,
        sourceProject: def.name,
        timestamp: now,
        title: `${def.name} source unavailable`,
        summary: prior?.retrievedAt ? `The latest check failed. MESH is showing the last successful snapshot from ${prior.retrievedAt}; this is not a no-risk result.` : 'The latest check failed and no source snapshot is available; this is not a no-risk result.',
        category: 'source-health', importance: 'high', evidenceType: def.evidenceType, sourceType: def.sourceType,
        links: [link(`Open ${def.name} repository`, repoUrl(def.repo))],
        provenance: { sourceProject: def.name, status: 'UNAVAILABLE', retrievedAt: prior?.retrievedAt || null, error: sourceState.error, sourceFiles: def.files.map((file) => file.path) },
        details: { error: sourceState.error, lastSuccessfulState: prior || null, label: 'UNAVAILABLE — absence of data is not absence of risk' },
        status: 'UNAVAILABLE', fingerprint: hash(sourceState.error),
      });
    }
  }
  const changed = JSON.stringify(sourceStates) !== JSON.stringify(previous.sourceStates || {});
  const generatedAt = changed || !previous.generated_at ? now : previous.generated_at;
  const priorUpdates = Array.isArray(previous.payload?.updates) ? previous.payload.updates : [];
  const updateById = new Map(priorUpdates.map((update) => [update.id, update]));
  for (const update of updates) updateById.set(update.id, update);
  const visibleUpdates = [...updateById.values()];
  for (const update of visibleUpdates) {
    if (update.sourceProject === 'Fraud Watch') {
      update.summary = update.summary.replace(/\b1 open investigations\b/g, '1 open investigation');
    }
  }
  const payload = publicPayload(generatedAt, sources, visibleUpdates);
  const state = { schema_version: BRIEFING_SCHEMA_VERSION, generated_at: generatedAt, sourceStates, payload };
  return { state, payload, changed };
}

export async function main() {
  const result = await buildBriefing();
  await mkdir(path.dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, `${JSON.stringify(result.state, null, 2)}\n`, 'utf8');
  await writeFile(PUBLIC_PATH, `// Generated by scripts/build-briefing.mjs — do not hand-edit.\nexport default ${JSON.stringify(result.payload, null, 2)};\n`, 'utf8');
  console.log(result.changed ? `BRIEFING_CHANGED: ${result.payload.updates.length} update(s) generated.` : 'NO_CHANGE: source outputs and briefing state unchanged.');
  for (const source of result.payload.sources) console.log(`${source.name}: ${source.status} (${source.freshness})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
