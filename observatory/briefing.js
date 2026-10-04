import briefing from './data/briefing.js';

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

function openEvidence(update) {
  const panel = $('evidence-panel');
  if (!panel) return;
  const source = briefing.sources.find((item) => item.name === update.sourceProject);
  panel.hidden = false;
  panel.innerHTML = `<div class="evidence-head"><div><span class="eyebrow">${escapeHtml(update.sourceProject)}</span><h2>${escapeHtml(update.title)}</h2></div><button id="evidence-close" type="button" aria-label="Close evidence">×</button></div>
    <p class="evidence-summary">${escapeHtml(update.summary)}</p>
    <div class="evidence-labels"><span>${escapeHtml(update.evidenceType)}</span><span>${escapeHtml(update.sourceType)}</span><span>${escapeHtml(update.status)}</span></div>
    <p class="evidence-freshness">MESH timestamp: ${escapeHtml(formatDate(update.timestamp))}. ${escapeHtml(source?.freshness || '')}</p>
    <div class="evidence-links">${renderLinks(update.links)}</div>
    <div class="evidence-details">${renderEvidenceObject(update.details)}</div>
    <details class="provenance"><summary>Show provenance</summary><pre>${escapeHtml(JSON.stringify(update.provenance || source || {}, null, 2))}</pre></details>`;
  $('evidence-close')?.addEventListener('click', () => { panel.hidden = true; });
  window.__orbActivateSource?.(sourceIdFromUpdate(update));
}

function markSeen(update) {
  state.seen[update.id] = { fingerprint: update.fingerprint, seenAt: Date.now() };
  persistSeen();
  renderUpdates();
}

function answerQuestion(rawQuestion) {
  const question = rawQuestion.trim();
  const q = question.toLowerCase();
  if (!question) return { text: 'Ask me about today, a source project, evidence, freshness, or what is real versus synthetic.' };
  if (/(jev|laya|swarm|escalat|investigate deeper)/.test(q)) {
    return { text: 'That deeper path is intentionally unavailable from this static Observatory. MESH can show grounded source evidence now; it cannot call Jev, Laya, or SWARM from this page.' };
  }
  if (/(real|synthetic|simulation|simulated|official)/.test(q)) {
    return { text: 'Evidence classes are kept separate: FOMO is REAL_WORLD external signal data in a repository snapshot; EU AI Act monitoring and Forecast Ledger use OFFICIAL sources/data; Fraud Watch, Shadow Network, and Risk Ring are SYNTHETIC/SIMULATED; Reg Search is a cited SNAPSHOT. MESH will not turn a simulation into a real incident.' };
  }
  if (/(source|link|evidence|report)/.test(q)) {
    const source = briefing.sources.find((item) => q.includes(item.name.toLowerCase()) || q.includes(item.id));
    const update = source && state.updates.find((item) => item.sourceProject === source.name);
    if (update) return { text: `I found the ${source.name} evidence. Open the matching briefing item to inspect its records and source links.`, update };
    if (source) return { text: `${source.name} has no new update in the current briefing. Its latest source status is ${source.status}; open the source chip above for provenance.` };
    return { text: 'Open a briefing item to inspect its underlying records, timestamps, hashes, and source URLs. I will not invent a source link.' };
  }
  const source = briefing.sources.find((item) => q.includes(item.name.toLowerCase()) || q.includes(item.id));
  if (source) {
    const update = state.updates.find((item) => item.sourceProject === source.name);
    if (update) return { text: `${source.name}: ${update.summary} Evidence class: ${update.evidenceType}. Freshness: ${source.freshness}.`, update };
    return { text: `${source.name} has no new update in the current completed check. Status: ${source.status}. Freshness: ${source.freshness}.` };
  }
  if (/(what.*new|what.*changed|brief|today|last 24|this week)/.test(q)) {
    const attention = state.updates.filter((item) => ['NEW', 'UPDATED', 'UNAVAILABLE'].includes(classify(item)));
    if (!state.updates.length) return { text: 'No new source updates were recorded in the latest completed check. That is not a no-risk conclusion.' };
    return { text: `${briefing.headline} ${attention.length} currently deserve attention. I would inspect the highest-importance item first, then verify its evidence class and freshness.` };
  }
  return { text: 'I can answer grounded questions about what changed, FOMO, Fraud Watch, Shadow Network, EU AI monitoring, Risk Ring, Forecast Ledger, Reg Search, evidence links, freshness, and whether a source is real, official, synthetic, simulated, snapshot, or unavailable.' };
}

function speak(text) {
  if (!('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  return true;
}

function wireConversation() {
  const question = $('mesh-question');
  const response = $('mesh-response');
  const submit = $('mesh-ask');
  const submitQuestion = () => {
    const result = answerQuestion(question?.value || '');
    if (response) response.textContent = result.text;
    if (result.update) openEvidence(result.update);
    if (state.voiceOutput) speak(result.text);
  };
  submit?.addEventListener('click', submitQuestion);
  question?.addEventListener('keydown', (event) => { if (event.key === 'Enter') submitQuestion(); });
  $('mesh-brief')?.addEventListener('click', () => {
    const result = answerQuestion("What's new today?");
    if (response) response.textContent = result.text;
    if (!speak(result.text)) if (response) response.textContent += ' Voice output is unavailable in this browser; the text briefing remains available.';
  });
  $('mesh-voice-output')?.addEventListener('click', () => {
    state.voiceOutput = !state.voiceOutput;
    $('mesh-voice-output').textContent = state.voiceOutput ? 'Voice responses on' : 'Voice responses off';
    if (!('speechSynthesis' in window)) $('mesh-voice-output').textContent = 'Voice output unavailable';
  });
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceButton = $('mesh-voice-input');
  if (!Recognition) {
    if (voiceButton) { voiceButton.disabled = true; voiceButton.textContent = 'Voice input unavailable'; }
    return;
  }
  const recognition = new Recognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.onstart = () => { if (voiceButton) voiceButton.textContent = 'Listening…'; };
  recognition.onend = () => { if (voiceButton) voiceButton.textContent = 'Talk to MESH'; };
  recognition.onerror = () => { if (response) response.textContent = 'Voice input could not be completed. Text conversation remains available.'; };
  recognition.onresult = (event) => { if (question) question.value = event.results[0][0].transcript; submitQuestion(); };
  voiceButton?.addEventListener('click', () => recognition.start());
}

function wire() {
  const priorLastOpen = Number(localStorage.getItem(LAST_OPEN_KEY) || 0);
  state.lastOpen = Number.isFinite(priorLastOpen) && priorLastOpen > 0 ? priorLastOpen : null;
  state.seen = restoreSeen();
  state.updates = briefing.updates || [];
  renderSourceStatus();
  renderUpdates();
  state.updates.forEach((update, index) => setTimeout(() => window.__orbActivateSource?.(sourceIdFromUpdate(update)), index * 220));
  document.querySelectorAll('[data-briefing-filter]').forEach((button) => button.addEventListener('click', () => {
    state.filter = button.dataset.briefingFilter;
    document.querySelectorAll('[data-briefing-filter]').forEach((item) => item.classList.toggle('active', item === button));
    renderUpdates();
  }));
  $('mesh-mark-read')?.addEventListener('click', () => { state.updates.forEach(markSeen); });
  wireConversation();
  try { localStorage.setItem(LAST_OPEN_KEY, String(Date.now())); } catch { /* optional memory */ }
}

wire();

export { answerQuestion };
