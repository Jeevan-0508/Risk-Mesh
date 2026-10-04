import briefing from './data/briefing.js?v=6';
import { createCalypso } from './calypso.js?v=11';

const SEEN_KEY = 'risk-mesh:briefing-seen-v1';
const LAST_OPEN_KEY = 'risk-mesh:briefing-last-open-v1';
const state = { filter: 'today', updates: [], seen: {}, lastOpen: null, voiceOutput: false };

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function restoreSeen() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function persistSeen() {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(state.seen)); } catch { /* local memory remains useful */ }
}

function classify(update) {
  const prior = state.seen[update.id];
  if (!prior) return 'NEW';
  return prior.fingerprint === update.fingerprint ? 'SEEN' : 'UPDATED';
}

function sourceIdFromUpdate(update) {
  return briefing.sources.find((source) => source.name === update.sourceProject)?.id || update.sourceProject.toLowerCase().replaceAll(' ', '-');
}

function sourceClass(source) {
  return String(source || '').toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
}

function formatDate(value) {
  if (!value) return 'timestamp unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function timeAge(value) {
  if (!value) return 'age unavailable';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'age unavailable';
  const hours = Math.max(0, Math.round((Date.now() - time) / 3600000));
  if (hours < 1) return 'checked less than an hour ago';
  if (hours === 1) return 'checked 1 hour ago';
  if (hours < 48) return `checked ${hours} hours ago`;
  return `checked ${Math.round(hours / 24)} days ago`;
}

function isInFilter(update) {
  if (state.filter === 'since') return !state.seen[update.id] || new Date(update.timestamp).getTime() > (state.lastOpen || 0);
  const age = Date.now() - new Date(update.timestamp).getTime();
  if (state.filter === '24h') return age <= 24 * 3600000;
  if (state.filter === 'week') return age <= 7 * 24 * 3600000;
  return age <= 24 * 3600000 || !state.lastOpen;
}

function valueSummary(value) {
  if (Array.isArray(value)) return `${value.length} record${value.length === 1 ? '' : 's'}`;
  if (value && typeof value === 'object') return Object.keys(value).length ? `${Object.keys(value).length} fields` : 'empty object';
  return String(value ?? 'not supplied');
}

function renderLinks(links = []) {
  return links.filter((item) => item?.url).map((item) => `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.label || 'Open source')} ↗</a>`).join('');
}

function renderSourceStatus() {
  const el = $('mesh-sources');
  if (!el) return;
  el.innerHTML = briefing.sources.map((source) => `
    <button class="source-chip ${sourceClass(source.sourceType)}" type="button" data-source="${escapeHtml(source.id)}" title="${escapeHtml(source.trust)}">
      <span class="source-dot"></span><span>${escapeHtml(source.name)}</span><strong>${escapeHtml(source.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : source.sourceType)}</strong>
    </button>`).join('');
  el.querySelectorAll('[data-source]').forEach((button) => button.addEventListener('click', () => {
    const source = briefing.sources.find((item) => item.id === button.dataset.source);
    if (!source) return;
    const sourceUpdate = state.updates.find((update) => update.sourceProject === source.name);
    if (sourceUpdate) {
      openEvidence(sourceUpdate);
      return;
    }
    openEvidence({
      sourceProject: source.name,
      title: `${source.name} source status`,
      summary: source.status === 'UNAVAILABLE' ? 'The latest check failed. This is not a no-risk result.' : source.trust,
      timestamp: source.retrievedAt,
      links: source.sourceUrls?.map((url) => ({ label: 'Source artifact', url })) || [],
      provenance: source,
      details: { status: source.status, freshness: source.freshness, capabilities: source.capabilities, sourceType: source.sourceType, evidenceType: source.evidenceType },
    });
  }));
}

function renderUpdates() {
  const el = $('mesh-updates');
  const countEl = $('mesh-update-count');
  if (!el) return;
  const visible = state.updates.filter(isInFilter);
  if (countEl) countEl.textContent = `${visible.length} update${visible.length === 1 ? '' : 's'} · ${visible.filter((item) => ['NEW', 'UPDATED', 'UNAVAILABLE'].includes(classify(item))).length} deserve attention`;
  if (!visible.length) {
    el.innerHTML = `<div class="empty-state">No source updates match this window. That means no update was recorded — not that no risk exists.</div>`;
    return;
  }
  el.innerHTML = visible.map((update) => {
    const status = classify(update);
    const source = briefing.sources.find((item) => item.name === update.sourceProject);
    return `<article class="update-card importance-${escapeHtml(update.importance)} status-${status.toLowerCase()} source-${sourceClass(source?.sourceType)}" data-update-id="${escapeHtml(update.id)}">
      <div class="update-topline"><span class="update-source">${escapeHtml(update.sourceProject)}</span><span class="update-status">${status}</span></div>
      <h3>${escapeHtml(update.title)}</h3>
      <p>${escapeHtml(update.summary)}</p>
      <div class="update-meta"><span>${escapeHtml(update.evidenceType)}</span><span>${escapeHtml(source?.sourceType || update.sourceType)}</span><span>${escapeHtml(timeAge(update.timestamp))}</span></div>
      <button class="evidence-button" type="button">View evidence ↗</button>
    </article>`;
  }).join('');
  el.querySelectorAll('[data-update-id]').forEach((card) => {
    const update = state.updates.find((item) => item.id === card.dataset.updateId);
    if (!update) return;
    const activate = () => { window.__orbActivateSource?.(sourceIdFromUpdate(update)); openEvidence(update); };
    card.addEventListener('click', activate);
    card.querySelector('button')?.addEventListener('click', (event) => { event.stopPropagation(); activate(); });
    card.addEventListener('mouseenter', () => window.__orbActivateSource?.(sourceIdFromUpdate(update)));
  });
}

function renderEvidenceObject(value) {
  if (!value || typeof value !== 'object') return `<p>${escapeHtml(value)}</p>`;
  const entries = Object.entries(value).filter(([key]) => !['label'].includes(key));
  return entries.map(([key, item]) => `<div class="evidence-field"><span>${escapeHtml(key)}</span><strong>${escapeHtml(valueSummary(item))}</strong>${Array.isArray(item) && item.length && typeof item[0] === 'object' ? `<pre>${escapeHtml(JSON.stringify(item.slice(0, 12), null, 2))}</pre>` : ''}</div>`).join('');
}

function renderFomoRecord(record, index) {
  const fields = [
    record.timestamp ? `<span>${escapeHtml(formatDate(record.timestamp))}</span>` : '',
    record.foundAt ? `<span>found ${escapeHtml(formatDate(record.foundAt))}</span>` : '',
    record.location ? `<span>location: ${escapeHtml(record.location)}</span>` : '',
    record.category ? `<span>${escapeHtml(record.category)}</span>` : '',
    record.severity ? `<span>${escapeHtml(record.severity)} severity</span>` : '',
    record.source ? `<span>${escapeHtml(record.source)}</span>` : '',
  ].filter(Boolean).join('');
  const links = renderLinks(record.links || []);
  return `<article class="fomo-record" data-fomo-record="${escapeHtml(record.id || index)}">
    <div class="fomo-record-index">${index + 1}</div>
    <div class="fomo-record-body"><h3>${escapeHtml(record.title || `FOMO report ${index + 1}`)}</h3>
    <div class="fomo-record-meta">${fields || '<span>record metadata not supplied</span>'}</div>
    ${record.summary ? `<p>${escapeHtml(record.summary)}</p>` : ''}
    <div class="fomo-record-links">${links || '<span class="muted">No original URL was supplied in this record.</span>'}</div></div>
  </article>`;
}

function renderFomoRecords(update) {
  const records = Array.isArray(update.details?.records) ? update.details.records : [];
  if (!records.length) return '<p class="empty-state">The checked FOMO update contains no individual records.</p>';
  return `<div class="fomo-primary"><div class="fomo-primary-head"><span class="eyebrow">FOMO · REAL WORLD</span><strong>${records.length} RECORD${records.length === 1 ? '' : 'S'}</strong></div>
    <p class="fomo-primary-note">Every record below comes from the checked FOMO artifact. Original source links are shown individually; technical provenance stays below.</p>
    <div class="fomo-record-list">${records.map(renderFomoRecord).join('')}</div></div>`;
}

function openEvidence(update, focusRecordId = null) {
  const panel = $('evidence-panel');
  if (!panel) return;
  const source = briefing.sources.find((item) => item.name === update.sourceProject);
  const isFomo = update.sourceProject === 'FOMO';
  const technicalDetails = { ...(update.details || {}) };
  if (isFomo) delete technicalDetails.records;
  panel.hidden = false;
  panel.innerHTML = `<div class="evidence-head"><div><span class="eyebrow">${escapeHtml(update.sourceProject)}</span><h2>${escapeHtml(update.title)}</h2></div><button id="evidence-close" type="button" aria-label="Close evidence">×</button></div>
    <p class="evidence-summary">${escapeHtml(update.summary)}</p>
    <div class="evidence-labels"><span>${escapeHtml(update.evidenceType)}</span><span>${escapeHtml(update.sourceType)}</span><span>${escapeHtml(update.status)}</span></div>
    <p class="evidence-freshness">MESH timestamp: ${escapeHtml(formatDate(update.timestamp))}. ${escapeHtml(source?.freshness || '')}</p>
    ${isFomo ? renderFomoRecords(update) : `<div class="evidence-links">${renderLinks(update.links)}</div><div class="evidence-details">${renderEvidenceObject(technicalDetails)}</div>`}
    <details class="technical-provenance"><summary>Technical provenance</summary><div class="evidence-links">${renderLinks(update.links)}</div><div class="evidence-details">${renderEvidenceObject(technicalDetails)}</div><pre>${escapeHtml(JSON.stringify(update.provenance || source || {}, null, 2))}</pre></details>`;
  $('evidence-close')?.addEventListener('click', () => { panel.hidden = true; });
  if (focusRecordId) [...panel.querySelectorAll('[data-fomo-record]')].find((item) => item.dataset.fomoRecord === focusRecordId)?.scrollIntoView({ block: 'center' });
  window.__orbActivateSource?.(sourceIdFromUpdate(update));
}

function markSeen(update) {
  state.seen[update.id] = { fingerprint: update.fingerprint, seenAt: Date.now() };
  persistSeen();
  renderUpdates();
}

function wire() {
  const priorLastOpen = Number(localStorage.getItem(LAST_OPEN_KEY) || 0);
  state.lastOpen = Number.isFinite(priorLastOpen) && priorLastOpen > 0 ? priorLastOpen : null;
  state.seen = restoreSeen();
  state.updates = briefing.updates || [];
  if ($('mesh-headline')) $('mesh-headline').textContent = briefing.headline || '';
  renderSourceStatus();
  renderUpdates();
  state.updates.forEach((update, index) => setTimeout(() => window.__orbActivateSource?.(sourceIdFromUpdate(update)), index * 220));
  document.querySelectorAll('[data-briefing-filter]').forEach((button) => button.addEventListener('click', () => {
    state.filter = button.dataset.briefingFilter;
    document.querySelectorAll('[data-briefing-filter]').forEach((item) => item.classList.toggle('active', item === button));
    renderUpdates();
  }));
  $('mesh-mark-read')?.addEventListener('click', () => { state.updates.forEach(markSeen); });
  createCalypso({
    briefing,
    $,
    escapeHtml,
    getUpdates: () => state.updates,
    onOpenEvidence: openEvidence,
    onActivateSource: (sourceId) => window.__orbActivateSource?.(sourceId),
    renderConversationLinks: (links) => {
      const el = $('calypso-links');
      if (!el) return;
      el.innerHTML = links?.length ? `<span class="calypso-links-label">SOURCE LINKS</span>${links.map((item) => `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.label || 'Open original source')} ↗</a>`).join('')}` : '';
    },
  });
  try { localStorage.setItem(LAST_OPEN_KEY, String(Date.now())); } catch { /* optional memory */ }
}

wire();
