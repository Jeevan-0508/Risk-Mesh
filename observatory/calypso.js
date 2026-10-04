import { buildMeshContext, createPrimaryCalypsoProvider, mapRecognitionError, renderSpeechText } from './calypso-core.mjs?v=4';
import { createLocalIntelligence, createLocalTranscriber } from './calypso-local.js?v=4';
import { createPrivateCustomVoice } from './calypso-voice.js';

const VOICE_KEY = 'risk-mesh:calypso-voice-uri-v1';
const INTELLIGENCE_KEY = 'risk-mesh:calypso-intelligence-v2';
const SPEECH_KEY = 'risk-mesh:calypso-speech-v2';
const SILENCE_WINDOW_MS = 900;
const NO_SPEECH_TIMEOUT_MS = 7000;
const MAX_RECORDING_MS = 60000;
const SPEECH_RMS_THRESHOLD = 0.035;

const FEMALE_VOICE_HINTS = [
  'female', 'samantha', 'victoria', 'karen', 'ava', 'allison', 'susan', 'zira', 'aria', 'jenny', 'google us english',
];

function voiceScore(voice) {
  const name = String(voice.name || '').toLowerCase();
  const lang = String(voice.lang || '').toLowerCase();
  let score = lang.startsWith('en') ? 20 : 0;
  if (FEMALE_VOICE_HINTS.some((hint) => name.includes(hint))) score += 30;
  if (voice.localService) score += 5;
  return score;
}

function cleanForSpeech(text) {
  return String(text || '').replace(/↗/g, '').replace(/\s+/g, ' ').trim();
}

function cleanDisplayText(text) {
  return String(text || '').replace(/^(?:assistant|system|final|partial|raw)\s*:\s*/i, '').replace(/\s+/g, ' ').trim();
}

function classifyQuestion(question) {
  return String(question || '').trim().toLowerCase();
}

export function createCalypso({ briefing, $, escapeHtml, getUpdates, onOpenEvidence, onActivateSource, renderConversationLinks }) {
  const state = {
    status: 'IDLE',
    voiceOn: false,
    voices: [],
    selectedVoice: null,
    recognition: null,
    recognitionUnavailable: false,
    recognitionStartTimer: null,
    recognitionNoSpeechTimer: null,
    recognitionSession: null,
    recorder: null,
    recorderStarting: false,
    recorderStopRequested: false,
    captureStream: null,
    recorderChunks: [],
    audioMonitor: null,
    stopReason: null,
    speechDiagnostics: [],
    intelligence: 'deterministic',
    speechMode: 'browser',
    localAI: null,
    localSTT: null,
    customVoice: null,
    primaryProvider: createPrimaryCalypsoProvider(),
    turn: null,
    turnSequence: 0,
    lastTurnMetrics: null,
    lastResponseSource: 'NOT_RUN',
    lastAIError: null,
    lastResult: null,
    memory: [],
    context: null,
  };

  const response = $('mesh-response');
  const question = $('mesh-question');
  const voiceButton = $('mesh-voice-input');
  const voiceToggle = $('calypso-voice-toggle');
  const voiceSelect = $('calypso-voice-select');
  const stopButton = $('calypso-stop-speaking');
  const intelligenceSelect = $('calypso-intelligence-select');
  const localAIButton = $('calypso-local-ai-enable');
  const aiProgress = $('calypso-ai-progress');
  const aiDiagnostics = $('calypso-ai-diagnostics');
  const speechSelect = $('calypso-speech-select');
  const speechProgress = $('calypso-speech-progress');
  const speechDiagnostics = $('calypso-speech-diagnostics');
  const turnDiagnostics = $('calypso-turn-diagnostics');
  const transcript = $('calypso-transcript');
  const error = $('calypso-error');
  const stateLabel = $('calypso-state');
  const engineLabel = $('calypso-engine');

  function setProgress(element, value, label) {
    if (!element) return;
    element.textContent = value == null ? label : `${label} · ${value}%`;
    element.dataset.progress = value == null ? '' : String(value);
  }

  function setEngine(label) {
    if (engineLabel) engineLabel.textContent = label;
  }

  function setSpeechDiagnostic(name, detail = '') {
    const line = `${new Date().toLocaleTimeString()} · ${name}${detail ? ` · ${detail}` : ''}`;
    state.speechDiagnostics = [...state.speechDiagnostics.slice(-19), line];
    if (speechDiagnostics) speechDiagnostics.textContent = state.speechDiagnostics.join('\n');
    console.debug(`[CALYPSO SPEECH] ${line}`);
  }

  function setAIDiagnostics(overrides = {}) {
    if (!aiDiagnostics) return;
    const runtime = state.localAI?.diagnostics?.() || {};
    const values = {
      mode: state.intelligence === 'local' ? 'LOCAL_AI' : 'DETERMINISTIC',
      model: runtime.model || 'onnx-community/SmolLM2-360M-Instruct-ONNX',
      modelLabel: runtime.modelLabel || 'SmolLM2 browser profile',
      transformersVersion: runtime.transformersVersion || '3.8.1',
      backend: runtime.backend || 'NOT_SELECTED',
      webgpuAvailable: runtime.webgpuAvailable == null ? Boolean(navigator.gpu) : runtime.webgpuAvailable,
      wasmAvailable: runtime.wasmAvailable == null ? typeof WebAssembly !== 'undefined' : runtime.wasmAvailable,
      modelDownloadState: runtime.modelDownloadState || 'NOT_STARTED',
      modelInitializationState: runtime.modelInitializationState || 'NOT_STARTED',
      pipelineState: runtime.pipelineState || 'NOT_INITIALIZED',
      lastInferenceBackend: runtime.lastInferenceBackend || 'NOT_RUN',
      lastInferenceDuration: runtime.lastInferenceDuration || 'NOT_RUN',
      lastResponseSource: overrides.lastResponseSource || state.lastResponseSource || runtime.lastResponseSource || 'NOT_RUN',
      lastError: overrides.lastError || state.lastAIError || runtime.lastError || 'NONE',
      status: runtime.status || (state.intelligence === 'local' ? 'NOT_DOWNLOADED' : 'IDLE'),
      controlledTest: runtime.controlledTest || 'NOT_RUN',
    };
    aiDiagnostics.textContent = [
      `MODE: ${values.mode}`,
      `MODEL: ${values.model}`,
      `MODEL PROFILE: ${values.modelLabel}`,
      `TRANSFORMERS.JS: ${values.transformersVersion}`,
      `BACKEND: ${values.backend}`,
      `WEBGPU: ${values.webgpuAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}`,
      `WASM: ${values.wasmAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}`,
      `STATUS: ${values.status}`,
      `MODEL DOWNLOAD: ${values.modelDownloadState}`,
      `MODEL INITIALIZATION: ${values.modelInitializationState}`,
      `PIPELINE: ${values.pipelineState}`,
      `CONTROLLED TEST: ${values.controlledTest}`,
      `LAST INFERENCE BACKEND: ${values.lastInferenceBackend}`,
      `LAST INFERENCE: ${values.lastInferenceDuration}`,
      `LAST RESPONSE: ${values.lastResponseSource}`,
      `LAST ERROR: ${values.lastError}`,
      `PRIMARY INTELLIGENCE: ${state.primaryProvider.status}`,
    ].join('\n');
  }

  function setTurnDiagnostics() {
    if (!turnDiagnostics) return;
    const metrics = state.lastTurnMetrics;
    if (!metrics) {
      turnDiagnostics.textContent = 'No completed turn yet.';
      return;
    }
    const seconds = (value) => value == null ? '—' : `${(value / 1000).toFixed(2)} s`;
    turnDiagnostics.textContent = [
      `TURN: ${metrics.id}`,
      `STT BACKEND: ${metrics.sttBackend || 'NOT_RUN'}`,
      `CAPTURE: ${seconds(metrics.captureMs)}`,
      `STT: ${seconds(metrics.sttMs)}`,
      `MESH: ${seconds(metrics.retrievalMs)}`,
      `LLM: ${metrics.llmBackend || 'NOT_RUN'} · ${seconds(metrics.llmMs)}`,
      `LLM FIRST TOKEN: ${seconds(metrics.llmFirstTokenMs)}`,
      `TTS: ${metrics.ttsBackend || 'NOT_RUN'} · ${seconds(metrics.ttsStartMs)}`,
      `TOTAL: ${seconds(metrics.totalMs)}`,
      `RESPONSE SOURCE: ${metrics.responseSource || 'NOT_RUN'}`,
      `FALLBACK: ${metrics.fallbackReason || 'NO'}`,
      `END OF SPEECH: ${metrics.automaticEnd ? 'AUTOMATIC' : 'MANUAL / TYPED'}`,
    ].join('\n');
  }

  function beginTurn(source = 'typed') {
    const busyStates = new Set(['REQUESTING_MIC', 'LISTENING', 'END_OF_SPEECH', 'TRANSCRIBING', 'RETRIEVING', 'THINKING', 'SPEAKING']);
    if (state.turn && busyStates.has(state.status)) return false;
    state.turn = {
      id: ++state.turnSequence,
      source,
      startedAt: performance.now(),
      metrics: { id: state.turnSequence, automaticEnd: false },
    };
    return true;
  }

  function activeMetrics() {
    return state.turn?.metrics || null;
  }

  function completeTurn() {
    if (!state.turn) return;
    state.turn.metrics.totalMs = Math.round(performance.now() - state.turn.startedAt);
    state.lastTurnMetrics = state.turn.metrics;
    state.turn = null;
    setTurnDiagnostics();
  }

  function setState(next, errorCode = '') {
    const displayState = next === 'IDLE' ? 'READY' : next;
    state.status = displayState;
    if (state.speechMode === 'local') setSpeechDiagnostic('STATE', errorCode ? `${displayState} · ${errorCode}` : displayState);
    if (stateLabel) {
      stateLabel.textContent = `CALYPSO ● ${displayState}`;
      stateLabel.dataset.state = displayState;
    }
    if (error) error.textContent = errorCode ? errorCode : '';
    if (voiceButton) {
      const localPath = (state.speechMode === 'local' || !state.recognition) && Boolean(navigator.mediaDevices?.getUserMedia && globalThis.MediaRecorder);
      voiceButton.textContent = state.recognitionUnavailable && !localPath ? 'Voice input unavailable' : displayState === 'REQUESTING_MIC' ? 'Requesting microphone…' : displayState === 'LISTENING' ? 'Listening…' : displayState === 'STOPPING' ? 'Stopping…' : displayState === 'END_OF_SPEECH' ? 'Wrapping up…' : displayState === 'TRANSCRIBING' ? 'Transcribing…' : displayState === 'RETRIEVING' ? 'Checking MESH…' : displayState === 'THINKING' ? 'Calypso is thinking…' : displayState === 'SPEAKING' ? 'Calypso is speaking…' : 'Talk to Calypso';
      voiceButton.dataset.state = displayState;
      const busy = ['TRANSCRIBING', 'RETRIEVING', 'THINKING'].includes(displayState);
      voiceButton.disabled = (!state.recognition && !localPath) || (state.recognitionUnavailable && !localPath) || busy;
    }
    if (displayState === 'LISTENING' || displayState === 'SPEAKING' || displayState === 'THINKING' || displayState === 'RETRIEVING') onActivateSource?.(`calypso-${displayState.toLowerCase()}`);
  }

  function setTranscript(value) {
    if (!transcript) return;
    transcript.textContent = value ? `You: ${String(value).replace(/^(?:FINAL|PARTIAL|LIVE|RAW):\s*/i, '')}` : 'You: —';
  }

  function fomoUpdate() {
    return getUpdates().find((update) => update.sourceProject === 'FOMO');
  }

  function fomoRecords(update = fomoUpdate()) {
    return Array.isArray(update?.details?.records) ? update.details.records : [];
  }

  function sourceUpdate(name) {
    return getUpdates().find((update) => update.sourceProject.toLowerCase() === name.toLowerCase());
  }

  function remember(questionText, result) {
    state.memory.push({ question: questionText, answer: result.text, source: result.update?.sourceProject || null });
    state.memory = state.memory.slice(-8);
    state.lastResult = result;
    if (result.update) {
      state.context = { source: result.update.sourceProject, records: fomoRecords(result.update), update: result.update, recordId: result.recordId || null };
    }
  }

  function recordName(record, index) {
    return record?.title || `FOMO report ${index + 1}`;
  }

  function sourceTruth(update) {
    if (!update) return 'I do not have a completed MESH update for that source.';
    const status = String(update.status || '').toUpperCase();
    if (status === 'UNAVAILABLE' || status === 'FAILED') return `I couldn't verify ${update.sourceProject} in the latest run. That is source failure, not evidence that nothing happened.`;
    if (status === 'STALE') return `My latest ${update.sourceProject} snapshot is stale, so I wouldn't treat it as current.`;
    return '';
  }

  function bestFomoRecord(records) {
    const rank = { critical: 4, high: 3, medium: 2, low: 1 };
    return [...records].sort((a, b) => (rank[String(b.severity).toLowerCase()] || 0) - (rank[String(a.severity).toLowerCase()] || 0))[0];
  }

  function followUpAnswer(q, fomo, records) {
    const context = state.context;
    const last = state.lastResult;
    if (/^(yeah|yes|yep|sure|go ahead|okay|ok|please)\b/.test(q) && last?.update) {
      if (last.update.sourceProject === 'FOMO' && records.length) {
        const picks = records.slice(0, 3).map((record, index) => `${index + 1}. ${recordName(record, index)}`).join(' ');
        return { text: `Here are the first three FOMO items from the checked snapshot: ${picks}`, update: fomo, links: records.slice(0, 3).flatMap((record) => record.links || []) };
      }
      return { text: last.text, update: last.update };
    }
    if (/^(why|why\??|what do you think)\b/.test(q) && last?.update) {
      if (last.update.sourceProject === 'FOMO') return { text: 'Because FOMO is the real-world external-signal set in this snapshot. I would inspect its original links first, while keeping the snapshot and freshness caveat in view.', update: last.update };
      if (String(last.update.sourceType).toUpperCase() === 'SYNTHETIC') return { text: `Because ${last.update.sourceProject} is synthetic simulation data. It can be useful for testing patterns, but it is not a confirmed real-world incident.`, update: last.update };
      return { text: `Because MESH has the strongest completed evidence for ${last.update.sourceProject} in the current snapshot. I would still check its freshness before treating it as current.`, update: last.update };
    }
    if (/^(tell me more|more about that|go deeper)\b/.test(q) && last?.update) {
      return { text: last.text, update: last.update, recordId: last.recordId, links: last.links || [] };
    }
    if (/^(open it|open that|show me the source)\b/.test(q) && last?.update) {
      const links = last.links || (last.recordId ? fomoRecords(last.update).find((record) => record.id === last.recordId)?.links || [] : []);
      return { text: links.length ? 'I’ve placed the checked source links below.' : 'I do not have an original source link for that item.', update: last.update, recordId: last.recordId, links };
    }
    if (/(compare|versus|vs\.?|contrast)/.test(q) && context?.update) {
      const fraud = sourceUpdate('Fraud Watch');
      return fraud ? { text: `FOMO is REAL_WORLD external-source snapshot data; Fraud Watch is SYNTHETIC simulation data. They should not be blended into one incident count.`, update: context.update } : { text: 'I can compare the evidence classes, but I need both completed source updates in MESH.' };
    }
    if (/(what should|where should|look at first|start with)/.test(q)) {
      const record = bestFomoRecord(records);
      return record ? { text: `I’d start with “${recordName(record, records.indexOf(record))}”${record.severity ? ` because it is marked ${record.severity} severity` : ''}. It remains a REAL_WORLD_SIGNAL snapshot, so open the original link before drawing a conclusion.`, update: fomo, recordId: record.id, links: record.links || [] } : { text: 'I do not have a prioritized FOMO record in the completed snapshot.' };
    }
    const location = q.match(/\b(?:what about|anything in|news from)\s+([a-z][a-z -]{2,})\??$/i)?.[1]?.trim();
    if (location) {
      const matches = records.filter((record) => `${record.location || ''} ${record.title || ''} ${record.summary || ''}`.toLowerCase().includes(location.toLowerCase()));
      return matches.length ? { text: `I found ${matches.length} FOMO record${matches.length === 1 ? '' : 's'} matching “${location}”: ${matches.slice(0, 3).map((record) => recordName(record, records.indexOf(record))).join('; ')}.`, update: fomo, links: matches.flatMap((record) => record.links || []) } : { text: `I don't have a FOMO record matching “${location}” in the checked snapshot.` };
    }
    if (/(that one|the (?:first|second|third|fourth|fifth)|^second$|^first$|^third$)/.test(q) && context?.source === 'FOMO') {
      const ordinal = q.match(/(?:the\s+)?(first|second|third|fourth|fifth)/)?.[1] || 'second';
      const positions = { first: 0, second: 1, third: 2, fourth: 3, fifth: 4 };
      const index = positions[ordinal];
      const record = context.records[index];
      if (!record) return { text: `I don't have a ${ordinal} FOMO record in the checked snapshot.` };
      return { text: `The ${ordinal} FOMO record is “${recordName(record, index)}.” It is classified as REAL_WORLD_SIGNAL in the checked snapshot.`, update: context.update, recordId: record.id, links: record.links || [] };
    }
    return null;
  }

  function groundedAnswer(rawQuestion) {
    const text = String(rawQuestion || '').trim();
    const q = classifyQuestion(text);
    if (!q) return { text: 'Ask me about the briefing, a source, evidence, or one of the FOMO reports.' };

    if (/^(hi|hello|hey|good morning|good afternoon)\b/.test(q)) {
      return { text: 'Hey. I’m here.' };
    }

    if (/(can you hear me|are you there|can you hear)\??$/.test(q)) {
      return { text: 'Yep, loud and clear.' };
    }

    const fomo = fomoUpdate();
    const records = fomoRecords(fomo);
    const followUp = followUpAnswer(q, fomo, records);
    if (followUp) return followUp;
    if (/(show|tell me about|list|what are).*fomo.*(report|signal|source)|fomo.*(report|signal)/.test(q)) {
      const count = records.length || fomo?.details?.recordCount || 0;
      const newCount = Number(fomo?.details?.newCount || 0);
      return {
        text: `I found ${count} FOMO report${count === 1 ? '' : 's'} in the checked snapshot${newCount ? `, including ${newCount} new signal${newCount === 1 ? '' : 's'}` : ''}. I’ll keep the original source links visible for each record.`,
        update: fomo,
        links: records.flatMap((record) => record.links || []),
      };
    }

    if (/(give|show|list|open).*(link|source)s?/.test(q)) {
      const context = state.context?.source === 'FOMO' ? state.context : { source: 'FOMO', records, update: fomo };
      const links = context.records.flatMap((record) => record.links || []);
      return {
        text: links.length ? `I have ${links.length} original FOMO source link${links.length === 1 ? '' : 's'}. They’re rendered below as individual links; the repository artifact remains separate provenance.` : 'The checked FOMO records do not contain original source URLs. I won’t invent any.',
        update: context.update,
        links,
      };
    }

    const ordinal = q.match(/\b(the\s+)?(first|second|third|fourth|fifth)(?:\s+(?:fomo\s+)?(?:one|story|report|signal))\b/);
    if (ordinal) {
      const positions = { first: 0, second: 1, third: 2, fourth: 3, fifth: 4 };
      const index = positions[ordinal[2]];
      const context = state.context?.source === 'FOMO' ? state.context : { source: 'FOMO', records, update: fomo };
      const record = context.records[index];
      if (!record) return { text: `I don’t have a ${ordinal[2]} FOMO record in the checked snapshot.` };
      const location = record.location ? ` Location: ${record.location}.` : ' The record has no separate location field, so I won’t infer one from its title.';
      return { text: `The ${ordinal[2]} FOMO record is “${recordName(record, index)}.”${location} It is classified as REAL_WORLD_SIGNAL from the checked FOMO snapshot.`, update: context.update, recordId: record.id, links: record.links || [] };
    }

    if (/(is|was).*\b(real|that real|this real)\b|real\??$/.test(q)) {
      if (state.context?.source === 'FOMO') return { text: 'The FOMO records are labelled REAL_WORLD_SIGNAL, but MESH is showing them as a repository snapshot of external reports—not a live browser connection or a verified incident feed.', update: state.context.update };
      if (state.context?.update?.sourceProject === 'Fraud Watch' || state.lastResult?.update?.sourceProject === 'Fraud Watch') return { text: 'No. Fraud Watch is SYNTHETIC simulation data. It is useful for testing methods of operation, but it is not a confirmed real-world fraud incident.', update: state.context?.update || state.lastResult?.update };
      return { text: 'MESH keeps the evidence classes separate: FOMO is REAL_WORLD external-source data in a repository snapshot; Fraud Watch, Shadow Network, and Risk Ring are SYNTHETIC simulations; EU AI Act Scanner and Forecast Ledger use OFFICIAL sources or data; Reg Search is a cited SNAPSHOT.' };
    }

    if (/fraud\s*watch/.test(q)) {
      const update = sourceUpdate('Fraud Watch');
      return update ? { text: `Fraud Watch found ${update.summary.replace(/^Synthetic\s*/i, '').replace(/\.$/, '')}. It is SYNTHETIC SIMULATION data, not real-world fraud evidence.`, update } : { text: 'Fraud Watch has no completed update in the current snapshot.' };
    }

    if (/(funny|scary|anything interesting)/.test(q)) {
      const update = fomo;
      const count = Number(update?.details?.newCount || 0);
      const riskRing = sourceUpdate('Risk Ring');
      return { text: `A few things. ${count ? `FOMO picked up ${count} new external signal${count === 1 ? '' : 's'}` : 'FOMO has no new external signal in this snapshot'}${riskRing ? ', and Risk Ring has a synthetic update worth keeping separate' : ''}. I’d start with FOMO because it is the real-world external-signal set.`, update };
    }

    if (/(what.*new|what.*changed|brief|today|last 24|this week)/.test(q)) {
      const updates = getUpdates();
      if (!updates.length) return { text: 'It is quiet in the completed snapshot. That means no update was recorded—not that no risk exists.' };
      const fomoNew = Number(fomo?.details?.newCount || 0);
      const fraud = sourceUpdate('Fraud Watch');
      const parts = [briefing.headline || `${updates.length} source updates are ready.`];
      if (fomoNew) parts.push(`FOMO picked up ${fomoNew} new external signal${fomoNew === 1 ? '' : 's'}.`);
      if (fraud) parts.push(`Fraud Watch reports ${fraud.summary.replace(/^Synthetic\s*/i, '').replace(/\.$/, '')}; that finding is synthetic.`);
      parts.push('I’d start with the highest-importance item and then inspect its evidence class and freshness.');
      return { text: parts.join(' '), update: fomo };
    }

    if (/(laya|jev|swarm|escalat|investigate deeper)/.test(q)) {
      return { text: 'That deeper path is intentionally unavailable from this static Observatory. Calypso can explain grounded MESH evidence, but Laya, Jev, and SWARM are not callable here.' };
    }

    if (/(source|link|evidence|report)/.test(q)) {
      const matched = briefing.sources.find((source) => q.includes(source.name.toLowerCase()) || q.includes(source.id));
      const update = matched && sourceUpdate(matched.name);
      if (update) return { text: sourceTruth(update) || `I found the ${matched.name} evidence. I’ll open its grounded details and source links.`, update };
      if (matched) return { text: `${matched.name} has no new update in the current briefing. Its status is ${matched.status}; the source chip still exposes its provenance.` };
    }

    const matched = briefing.sources.find((source) => q.includes(source.name.toLowerCase()) || q.includes(source.id));
    if (matched) {
      const update = sourceUpdate(matched.name);
      return update ? { text: sourceTruth(update) || `${matched.name}: ${update.summary} Evidence class: ${update.evidenceType}. Freshness: ${matched.freshness}.`, update } : { text: `${matched.name} has no new update in the completed check. Status: ${matched.status}. Freshness: ${matched.freshness}.` };
    }

    return { text: 'I can help inspect what changed, FOMO reports and links, evidence, freshness, real versus synthetic data, or the current status of Fraud Watch, Shadow Network, EU AI monitoring, Risk Ring, Forecast Ledger, and Reg Search.' };
  }

  function showLinks(links = []) {
    renderConversationLinks?.(links);
  }

  function speak(text) {
    if (state.customVoice?.configured) {
      const metrics = activeMetrics();
      if (metrics) metrics.ttsBackend = 'custom-voice';
      setState('SPEAKING');
      const started = performance.now();
      state.customVoice.speak(renderSpeechText(text)).then((spoken) => {
        if (!spoken) browserSpeak(text);
        else {
          if (metrics) metrics.ttsStartMs = Math.round(performance.now() - started);
          setState('READY');
          completeTurn();
        }
      }).catch(() => {
        browserSpeak(text);
      });
      return true;
    }
    return browserSpeak(text);
  }

  function browserSpeak(text) {
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined') {
      setState('IDLE', 'SPEECH_SYNTHESIS_UNAVAILABLE');
      return false;
    }
    const utterance = new SpeechSynthesisUtterance(renderSpeechText(text));
    const selected = state.voices.find((voice) => voice.voiceURI === state.selectedVoice) || state.voices[0];
    if (selected) utterance.voice = selected;
    utterance.lang = selected?.lang || 'en-US';
    utterance.rate = 0.96;
    utterance.pitch = 1.02;
    const started = performance.now();
    const metrics = activeMetrics();
    if (metrics) metrics.ttsBackend = 'browser-speech-synthesis';
    utterance.onstart = () => {
      if (metrics) metrics.ttsStartMs = Math.round(performance.now() - started);
      setState('SPEAKING');
    };
    utterance.onend = () => {
      setState('READY');
      completeTurn();
    };
    utterance.oncancel = () => {
      setState('READY');
      completeTurn();
    };
    utterance.onerror = (event) => {
      setState('READY', `SPEECH_SYNTHESIS_${String(event.error || 'ERROR').toUpperCase()}`);
      completeTurn();
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return true;
  }

  async function submitQuestion(rawQuestion, { speakResponse = false, fromVoice = false } = {}) {
    const text = String(rawQuestion || '').trim();
    if (!text) {
      setState('READY', 'NO_TRANSCRIPT');
      return;
    }
    if (state.turn && ['REQUESTING_MIC', 'LISTENING', 'STOPPING', 'SPEAKING'].includes(state.status)) return;
    if (!state.turn && !beginTurn(fromVoice ? 'voice' : 'typed')) return;
    const metrics = activeMetrics();
    setState('RETRIEVING');
    const retrievalStarted = performance.now();
    const result = groundedAnswer(text);
    if (metrics) metrics.retrievalMs = Math.round(performance.now() - retrievalStarted);
    setState('THINKING');
    let finalResult = { ...result, responseSource: 'DETERMINISTIC' };
    let localFailureReason = null;
    let primaryFailureReason = null;
    if (state.primaryProvider.configured) {
      try {
        const llmStarted = performance.now();
        const generated = await state.primaryProvider.generate(buildMeshContext({ question: text, result, updates: getUpdates(), memory: state.memory }));
        if (metrics) {
          metrics.llmBackend = state.primaryProvider.id;
          metrics.llmMs = Math.round(performance.now() - llmStarted);
          metrics.llmFirstTokenMs = metrics.llmMs;
        }
        finalResult = { ...result, text: generated.text, generatedBy: 'PRIMARY_CALYPSO', responseSource: 'MESH_DIRECT' };
        state.lastResponseSource = finalResult.responseSource;
        state.lastAIError = null;
      } catch (caught) {
        primaryFailureReason = String(caught?.message || caught || 'PRIMARY_INTELLIGENCE_ERROR');
      }
    } else {
      primaryFailureReason = 'PRIMARY_INTELLIGENCE_UNCONFIGURED';
    }
    if (finalResult.generatedBy == null && (state.intelligence === 'local' || state.localAI?.state.ready)) {
      try {
        if (!state.localAI) await enableLocalAI();
        else if (!state.localAI.state.ready && state.localAI.state.status !== 'ERROR') await enableLocalAI();
        if (!state.localAI?.state.ready) throw new Error(state.localAI?.state.lastError || 'LOCAL_AI_NOT_READY');
        const llmStarted = performance.now();
        const generated = await state.localAI.generate(buildMeshContext({ question: text, result, updates: getUpdates(), memory: state.memory }));
        if (metrics) {
          metrics.llmBackend = generated.device || 'local-ai';
          metrics.llmMs = Math.round(performance.now() - llmStarted);
          metrics.llmFirstTokenMs = metrics.llmMs;
        }
        finalResult = { ...result, text: generated.text, generatedBy: 'LOCAL_AI', latencyMs: generated.latencyMs, responseSource: 'LOCAL_LLM' };
        state.lastResponseSource = finalResult.responseSource;
        state.lastAIError = null;
        setEngine(`LOCAL AI · ${generated.device} · ${generated.latencyMs}ms · MESH grounded`);
      } catch (caught) {
        localFailureReason = String(caught?.message || caught || 'LOCAL_AI_ERROR');
      }
    }
    if (finalResult.generatedBy == null) {
      const fallbackReason = localFailureReason || primaryFailureReason;
      const fallback = Boolean(localFailureReason);
      finalResult = { ...result, generatedBy: fallback ? 'DETERMINISTIC_FALLBACK' : 'DETERMINISTIC', responseSource: fallback ? 'DETERMINISTIC_FALLBACK' : 'DETERMINISTIC', fallbackReason };
      state.lastResponseSource = finalResult.responseSource;
      state.lastAIError = fallbackReason || null;
      if (metrics) {
        metrics.llmBackend = 'deterministic-calypso';
        metrics.llmMs = 0;
        metrics.llmFirstTokenMs = 0;
        metrics.fallbackReason = fallbackReason || null;
      }
      setEngine(fallback ? 'LOCAL AI FAILED · deterministic Calypso fallback' : 'PRIMARY UNCONFIGURED · deterministic Calypso');
    } else {
      state.lastResponseSource = finalResult.responseSource;
      if (metrics) metrics.responseSource = finalResult.responseSource;
    }
    if (metrics && !metrics.responseSource) metrics.responseSource = finalResult.responseSource;
    finalResult.text = cleanDisplayText(finalResult.text);
    remember(text, finalResult);
    if (response) response.textContent = `Calypso: ${finalResult.text}`;
    showLinks(finalResult.links || []);
    if (finalResult.update) onOpenEvidence?.(finalResult.update, finalResult.recordId);
    if (fromVoice) setTranscript(text);
    setAIDiagnostics({ lastResponseSource: finalResult.responseSource, lastError: localFailureReason || primaryFailureReason || undefined });
    if (state.voiceOn) {
      if (!speak(finalResult.text)) {
        setState('READY', 'SPEECH_SYNTHESIS_UNAVAILABLE');
        completeTurn();
      }
    } else {
      setState('READY', localFailureReason ? `LOCAL_AI_FAILED: ${localFailureReason}` : '');
      completeTurn();
    }
    setTurnDiagnostics();
    return finalResult;
  }

  function voiceLabel(voice) {
    return `${voice.name} · ${voice.lang}${voice.localService ? ' · installed' : ''}`;
  }

  function loadVoices() {
    if (!('speechSynthesis' in window)) {
      if (engineLabel) engineLabel.textContent = 'DETERMINISTIC FALLBACK · speech synthesis unavailable';
      return;
    }
    const all = window.speechSynthesis.getVoices();
    state.voices = all.filter((voice) => String(voice.lang || '').toLowerCase().startsWith('en'));
    if (!state.voices.length) state.voices = all;
    if (!state.voices.length) return;
    const stored = localStorage.getItem(VOICE_KEY);
    const preferred = state.voices.slice().sort((a, b) => voiceScore(b) - voiceScore(a))[0];
    state.selectedVoice = state.voices.some((voice) => voice.voiceURI === stored) ? stored : preferred?.voiceURI;
    if (voiceSelect) {
      voiceSelect.innerHTML = state.voices.map((voice) => `<option value="${escapeHtml(voice.voiceURI)}">${escapeHtml(voiceLabel(voice))}</option>`).join('');
      voiceSelect.value = state.selectedVoice || '';
      voiceSelect.disabled = false;
    }
    if (state.intelligence !== 'local') setEngine(`PRIMARY UNCONFIGURED · deterministic Calypso · ${state.voices.length} compatible voice${state.voices.length === 1 ? '' : 's'}`);
  }

  function setupRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      state.recognitionUnavailable = true;
      setState('READY', 'SPEECH_RECOGNITION_UNAVAILABLE');
      return;
    }
    state.recognition = new Recognition();
    state.recognition.continuous = false;
    state.recognition.interimResults = true;
    state.recognition.maxAlternatives = 1;
    state.recognition.lang = 'en-US';
    state.recognition.onstart = () => {
      if (state.recognitionStartTimer) clearTimeout(state.recognitionStartTimer);
      state.recognitionSession = { finalText: '', errorCode: '', submitted: false };
      const metrics = activeMetrics();
      if (metrics) {
        metrics.sttBackend = 'browser-recognition';
        metrics.sttStartedAt = performance.now();
      }
      if (state.recognitionNoSpeechTimer) clearTimeout(state.recognitionNoSpeechTimer);
      state.recognitionNoSpeechTimer = setTimeout(() => {
        if (state.recognitionSession?.finalText) return;
        state.recognitionSession.errorCode = 'NO_SPEECH_DETECTED';
        state.recognition.abort();
      }, NO_SPEECH_TIMEOUT_MS);
      setTranscript('');
      setState('LISTENING');
    };
    state.recognition.onaudiostart = () => setState('LISTENING');
    state.recognition.onspeechstart = () => setState('LISTENING');
    state.recognition.onresult = (event) => {
      let interim = '';
      let finalText = state.recognitionSession?.finalText || '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const phrase = event.results[index][0]?.transcript || '';
        if (event.results[index].isFinal) finalText += `${phrase} `;
        else interim += phrase;
      }
      if (state.recognitionSession) state.recognitionSession.finalText = finalText.trim();
      setTranscript((finalText || interim).trim());
    };
    state.recognition.onspeechend = () => {
      const metrics = activeMetrics();
      if (metrics) metrics.automaticEnd = true;
      setState('END_OF_SPEECH');
    };
    state.recognition.onaudioend = () => setState('END_OF_SPEECH');
    state.recognition.onerror = (event) => {
      const code = mapRecognitionError(event.error);
      if (state.recognitionSession && !state.recognitionSession.errorCode) state.recognitionSession.errorCode = code;
      setState('READY', state.recognitionSession?.errorCode || code);
    };
    state.recognition.onend = () => {
      const session = state.recognitionSession;
      if (!session) return;
      if (state.recognitionNoSpeechTimer) clearTimeout(state.recognitionNoSpeechTimer);
      const metrics = activeMetrics();
      if (metrics?.sttStartedAt) metrics.sttMs = Math.round(performance.now() - metrics.sttStartedAt);
      if (session.finalText && !session.submitted && !['NO_SPEECH_DETECTED', 'MICROPHONE_PERMISSION_DENIED'].includes(session.errorCode)) {
        session.submitted = true;
        setState('TRANSCRIBING');
        void submitQuestion(session.finalText, { speakResponse: true, fromVoice: true });
      } else if (!session.finalText && !session.errorCode) {
        setState('READY', 'NO_SPEECH_DETECTED');
        completeTurn();
      } else if (session.errorCode) {
        const canUseLocalFallback = ['SPEECH_RECOGNITION_NETWORK_ERROR', 'AUDIO_CAPTURE_ERROR', 'UNKNOWN_SPEECH_ERROR', 'ABORTED'].includes(session.errorCode)
          && navigator.mediaDevices?.getUserMedia && globalThis.MediaRecorder;
        if (canUseLocalFallback && !session.fallbackTried) {
          session.fallbackTried = true;
          setSpeechDiagnostic('STT FALLBACK', `${session.errorCode} · trying local Whisper`);
          void startLocalRecording();
          return;
        }
        setState('READY', ['MANUAL_STOP', 'CANCELLED'].includes(session.errorCode) ? '' : session.errorCode);
        completeTurn();
      }
    };
  }

  function stopAudioMonitor() {
    const monitor = state.audioMonitor;
    if (!monitor) return;
    if (monitor.frame) cancelAnimationFrame(monitor.frame);
    if (monitor.maxTimer) clearTimeout(monitor.maxTimer);
    if (monitor.context) monitor.context.close().catch(() => {});
    state.audioMonitor = null;
  }

  function watchForEndOfSpeech(stream) {
    const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextCtor) {
      setSpeechDiagnostic('AUDIO ACTIVITY', 'AudioContext unavailable; maximum duration and manual stop remain active');
      return;
    }
    const context = new AudioContextCtor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.2;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const monitor = { context, analyser, samples, startedAt: performance.now(), lastVoiceAt: 0, speechDetected: false, frame: null, maxTimer: null };
    state.audioMonitor = monitor;
    const metrics = activeMetrics();
    monitor.maxTimer = setTimeout(() => {
      state.stopReason = 'MAX_RECORDING_DURATION';
      stopLocalRecording('MAX_RECORDING_DURATION');
    }, MAX_RECORDING_MS);
    const sample = () => {
      if (state.audioMonitor !== monitor || !state.recorder || state.recorder.state === 'inactive') return;
      analyser.getFloatTimeDomainData(samples);
      let energy = 0;
      for (const value of samples) energy += value * value;
      const rms = Math.sqrt(energy / samples.length);
      const now = performance.now();
      if (rms >= SPEECH_RMS_THRESHOLD) {
        monitor.lastVoiceAt = now;
        if (!monitor.speechDetected) {
          monitor.speechDetected = true;
          if (metrics) metrics.speechDetectedAt = now;
          setSpeechDiagnostic('AUDIO ACTIVITY', `speech detected · rms=${rms.toFixed(3)}`);
        }
      } else if (monitor.speechDetected && now - monitor.lastVoiceAt >= SILENCE_WINDOW_MS) {
        state.stopReason = 'AUTOMATIC_END_OF_SPEECH';
        if (metrics) metrics.automaticEnd = true;
        setSpeechDiagnostic('AUDIO ACTIVITY', `silence ${SILENCE_WINDOW_MS}ms · automatic stop`);
        stopLocalRecording('AUTOMATIC_END_OF_SPEECH');
        return;
      } else if (!monitor.speechDetected && now - monitor.startedAt >= NO_SPEECH_TIMEOUT_MS) {
        state.stopReason = 'NO_SPEECH_DETECTED';
        stopLocalRecording('NO_SPEECH_DETECTED');
        return;
      }
      monitor.frame = requestAnimationFrame(sample);
    };
    monitor.frame = requestAnimationFrame(sample);
  }

  async function startLocalRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
      setState('READY', 'SPEECH_RECOGNITION_UNAVAILABLE');
      return;
    }
    if (state.recorderStarting) {
      state.recorderStopRequested = true;
      setSpeechDiagnostic('RECORDER STATE', 'stop requested while starting');
      return;
    }
    if (state.recorder) {
      setState('STOPPING');
      setSpeechDiagnostic('RECORDER STATE', `stop requested · ${state.recorder.state}`);
      if (state.recorder.state !== 'inactive') state.recorder.stop();
      return;
    }
    state.recorderStarting = true;
    state.recorderStopRequested = false;
    state.stopReason = null;
    setState('REQUESTING_MIC');
    setSpeechDiagnostic('MIC PERMISSION', 'requesting audio permission');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.captureStream = stream;
      const tracks = stream.getAudioTracks();
      setSpeechDiagnostic('MIC PERMISSION', 'granted');
      setSpeechDiagnostic('MEDIA STREAM', `audioTracks=${tracks.length}`);
      tracks.forEach((track) => setSpeechDiagnostic('AUDIO TRACK', `enabled=${track.enabled} readyState=${track.readyState} kind=${track.kind}`));
      const liveTrack = tracks.find((track) => track.enabled && track.readyState === 'live');
      if (!liveTrack) {
        stream.getTracks().forEach((track) => track.stop());
        state.captureStream = null;
        throw new Error('NO_AUDIO_TRACK');
      }
      state.recorderChunks = [];
      const preferredMimeType = MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      state.recorder = preferredMimeType ? new MediaRecorder(stream, { mimeType: preferredMimeType }) : new MediaRecorder(stream);
      const recorder = state.recorder;
      recorder.ondataavailable = (event) => {
        if (event.data?.size) state.recorderChunks.push(event.data);
        const bytes = state.recorderChunks.reduce((total, chunk) => total + chunk.size, 0);
        setSpeechDiagnostic('AUDIO CHUNKS', `count=${state.recorderChunks.length} bytes=${bytes}`);
      };
      recorder.onerror = (event) => setSpeechDiagnostic('RECORDER STATE', `error=${event.error?.message || 'recorder error'}`);
      recorder.onstart = () => {
        state.recorderStarting = false;
        const metrics = activeMetrics();
        if (metrics) {
          metrics.sttBackend = 'local-whisper';
          metrics.captureStartedAt = performance.now();
        }
        const activeTrack = state.captureStream?.getAudioTracks().find((track) => track.enabled && track.readyState === 'live');
        setSpeechDiagnostic('RECORDER STATE', `started · ${recorder.state}`);
        if (!activeTrack) {
          setState('STOPPING', 'NO_AUDIO_TRACK');
          recorder.stop();
          return;
        }
        setTranscript('');
        setState('LISTENING');
        watchForEndOfSpeech(stream);
        if (state.recorderStopRequested) {
          state.recorderStopRequested = false;
          setState('STOPPING');
          recorder.stop();
        }
      };
      recorder.onstop = async () => {
        setSpeechDiagnostic('RECORDER STATE', `stopped · ${recorder.state}`);
        stopAudioMonitor();
        state.captureStream?.getTracks().forEach((track) => track.stop());
        state.captureStream = null;
        state.recorder = null;
        state.recorderStarting = false;
        const blob = new Blob(state.recorderChunks, { type: recorder.mimeType || 'audio/webm' });
        setSpeechDiagnostic('BLOB SIZE', `bytes=${blob.size} type=${blob.type || 'unknown'}`);
        const metrics = activeMetrics();
        if (metrics?.captureStartedAt) metrics.captureMs = Math.round(performance.now() - metrics.captureStartedAt);
        if (!blob.size) {
          setState('READY', 'EMPTY_AUDIO_CAPTURE');
          completeTurn();
          return;
        }
        if (state.stopReason === 'NO_SPEECH_DETECTED') {
          setState('READY', 'NO_SPEECH_DETECTED');
          completeTurn();
          return;
        }
        if (metrics) metrics.sttBackend = 'local-whisper';
        setState('END_OF_SPEECH');
        setState('TRANSCRIBING');
        try {
          if (metrics) metrics.sttStartedAt = performance.now();
          state.localSTT ||= createLocalTranscriber({
            onStatus: (label) => setSpeechStatus(label),
            onProgress: (value) => setProgress(speechProgress, value, 'LOCAL TRANSCRIPTION'),
            onDiagnostic: setSpeechDiagnostic,
          });
          const text = await state.localSTT.transcribe(blob);
          if (metrics?.sttStartedAt) metrics.sttMs = Math.round(performance.now() - metrics.sttStartedAt);
          if (metrics) metrics.sttBackend = `local-whisper${state.localSTT.state.device ? `/${state.localSTT.state.device}` : ''}`;
          await state.localSTT.dispose?.();
          if (!text) {
            setState('READY', 'NO_SPEECH_DETECTED');
            completeTurn();
            return;
          }
          setTranscript(text);
          await submitQuestion(text, { speakResponse: true, fromVoice: true });
        } catch (caught) {
          if (metrics?.sttStartedAt) metrics.sttMs = Math.round(performance.now() - metrics.sttStartedAt);
          const message = String(caught?.message || caught || 'Unknown local speech error');
          const code = message === 'LOCAL_STT_NOT_READY' || message === 'EMPTY_AUDIO_CAPTURE' || message === 'NO_AUDIO_TRACK'
            ? message
            : message.startsWith('LOCAL_STT_ERROR:') ? message : `LOCAL_STT_ERROR: ${message}`;
          setState('READY', code);
          completeTurn();
        }
      };
      recorder.start(250);
      setSpeechDiagnostic('RECORDER STATE', `start requested · ${recorder.state}`);
    } catch (caught) {
      state.recorderStarting = false;
      state.captureStream?.getTracks().forEach((track) => track.stop());
      state.captureStream = null;
      const message = String(caught?.message || caught || 'AUDIO_CAPTURE_ERROR');
      const code = caught?.name === 'NotAllowedError' || caught?.name === 'SecurityError'
        ? 'MICROPHONE_PERMISSION_DENIED' : message === 'NO_AUDIO_TRACK' ? message : `AUDIO_CAPTURE_ERROR: ${message}`;
      setSpeechDiagnostic('MIC PERMISSION', `error=${code}`);
      setState('READY', code);
      completeTurn();
    }
  }

  function stopLocalRecording(reason = 'MANUAL_STOP') {
    state.recorderStopRequested = true;
    state.stopReason ||= reason;
    if (state.recorder && state.recorder.state !== 'inactive') {
      setState('STOPPING');
      state.recorder.stop();
    } else if (state.recorderStarting) {
      setState('STOPPING');
      setSpeechDiagnostic('RECORDER STATE', 'stop queued');
    }
  }

  function startListening() {
    if (state.status === 'SPEAKING') {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      state.customVoice?.stop();
      state.turn = null;
      setState('READY');
    }
    if (state.recorder || state.recorderStarting) {
      stopLocalRecording('MANUAL_STOP');
      return;
    }
    if (state.speechMode === 'local' || !state.recognition) {
      if (!beginTurn('voice')) return;
      void startLocalRecording();
      return;
    }
    if (!state.recognition) {
      setState('READY', 'SPEECH_RECOGNITION_UNAVAILABLE');
      return;
    }
    if (state.status === 'LISTENING') {
      state.recognitionSession && (state.recognitionSession.errorCode = 'MANUAL_STOP');
      state.recognition.stop();
      return;
    }
    if (!beginTurn('voice')) return;
    try {
      state.recognition.start();
      if (state.recognitionStartTimer) clearTimeout(state.recognitionStartTimer);
      state.recognitionStartTimer = setTimeout(() => {
        if (state.status === 'READY') setState('READY', 'SPEECH_RECOGNITION_START_TIMEOUT');
      }, 3500);
    } catch (caught) {
      setState('READY', caught?.name === 'InvalidStateError' ? 'ABORTED' : 'UNKNOWN_SPEECH_ERROR');
      completeTurn();
    }
  }

  function setSpeechStatus(label) {
    setEngine(label === 'LOCAL_STT_UNAVAILABLE' ? 'CALYPSO SPEECH · UNAVAILABLE' : `CALYPSO SPEECH · ${String(label).replaceAll('_', ' ')}`);
    setSpeechDiagnostic('WHISPER STATUS', String(label));
  }

  async function enableLocalAI() {
    state.localAI ||= createLocalIntelligence({
      onStatus: (label) => {
        const text = String(label).replaceAll('_', ' ');
        setEngine(label === 'LOCAL_AI_ERROR' ? 'LOCAL AI FAILED · falling back to deterministic Calypso' : `CALYPSO · ${text}`);
        setAIDiagnostics();
      },
      onProgress: (value) => setProgress(aiProgress, value, 'LOCAL AI DOWNLOAD'),
      onDiagnostic: () => setAIDiagnostics(),
    });
    state.intelligence = 'local';
    try { localStorage.setItem(INTELLIGENCE_KEY, 'local'); } catch { /* local memory remains useful */ }
    if (intelligenceSelect) intelligenceSelect.value = 'local';
    if (localAIButton) {
      localAIButton.disabled = true;
      localAIButton.textContent = 'LOCAL AI LOADING…';
    }
    setAIDiagnostics();
    try {
      await state.localAI.load();
      if (state.intelligence === 'local') {
        if (localAIButton) localAIButton.textContent = 'LOCAL AI READY';
        setEngine(`CALYPSO ● LOCAL AI READY · ${state.localAI.state.device} · MESH grounded`);
      }
      setAIDiagnostics();
      return true;
    } catch (caught) {
      const message = String(caught?.message || caught || 'LOCAL_AI_ERROR');
      state.lastAIError = message;
      if (state.intelligence === 'local') {
        if (localAIButton) { localAIButton.disabled = false; localAIButton.textContent = 'RETRY LOCAL AI'; }
        setEngine('LOCAL AI FAILED · falling back to deterministic Calypso');
      }
      setAIDiagnostics({ lastResponseSource: state.lastResponseSource, lastError: message });
      return false;
    }
  }

  function setupMicrophonePermissionState() {
    if (!navigator.permissions?.query) return;
    navigator.permissions.query({ name: 'microphone' }).then((permission) => {
      if (permission.state === 'denied') setState('IDLE', 'MICROPHONE_PERMISSION_DENIED');
      permission.onchange = () => {
        if (permission.state === 'denied') setState('IDLE', 'MICROPHONE_PERMISSION_DENIED');
        else if (permission.state === 'granted' && error?.textContent === 'MICROPHONE_PERMISSION_DENIED') setState('IDLE');
      };
    }).catch(() => { /* browser does not expose microphone permission state */ });
  }

  function setup() {
    setState('IDLE');
    const hasWebGPU = Boolean(navigator.gpu);
    try { state.intelligence = localStorage.getItem(INTELLIGENCE_KEY) === 'local' ? 'local' : 'deterministic'; } catch { state.intelligence = 'deterministic'; }
    try { state.speechMode = localStorage.getItem(SPEECH_KEY) === 'local' ? 'local' : 'browser'; } catch { state.speechMode = 'browser'; }
    if (intelligenceSelect) intelligenceSelect.value = state.intelligence;
    if (speechSelect) speechSelect.value = state.speechMode;
    if (engineLabel) engineLabel.textContent = `PRIMARY UNCONFIGURED · deterministic Calypso · local AI ${state.intelligence === 'local' ? 'initializing' : 'optional'} · ${hasWebGPU ? 'WebGPU available' : 'WebGPU unavailable'}`;
    setAIDiagnostics();
    loadVoices();
    if ('speechSynthesis' in window) window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    setupRecognition();
    if (state.recognition) setState('IDLE');
    setupMicrophonePermissionState();
    voiceButton?.addEventListener('click', startListening);
    $('mesh-ask')?.addEventListener('click', () => submitQuestion(question?.value || ''));
    question?.addEventListener('keydown', (event) => { if (event.key === 'Enter') submitQuestion(question.value || ''); });
    $('mesh-brief')?.addEventListener('click', () => void submitQuestion("What's new today?", { speakResponse: true }));
    voiceToggle?.addEventListener('click', () => {
      if (!('speechSynthesis' in window)) { setState('IDLE', 'SPEECH_SYNTHESIS_UNAVAILABLE'); return; }
      state.voiceOn = !state.voiceOn;
      voiceToggle.textContent = state.voiceOn ? 'VOICE ON' : 'VOICE OFF';
      if (!state.voiceOn) window.speechSynthesis.cancel();
    });
    stopButton?.addEventListener('click', () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      state.customVoice?.stop();
      if (state.recorder || state.recorderStarting) stopLocalRecording();
      else if (state.recognition && state.status === 'LISTENING') {
        if (state.recognitionSession) state.recognitionSession.errorCode = 'CANCELLED';
        state.recognition.abort();
      } else {
        setState('READY');
        completeTurn();
      }
    });
    voiceSelect?.addEventListener('change', () => {
      state.selectedVoice = voiceSelect.value;
      localStorage.setItem(VOICE_KEY, state.selectedVoice);
    });
    intelligenceSelect?.addEventListener('change', () => {
      state.intelligence = intelligenceSelect.value;
      if (state.intelligence === 'local') {
        if (localAIButton) localAIButton.hidden = false;
        setEngine('CALYPSO LOCAL AI · initializing');
        void enableLocalAI();
      } else {
        if (localAIButton) localAIButton.hidden = true;
        setEngine(`PRIMARY UNCONFIGURED · deterministic Calypso · ${hasWebGPU ? 'WebGPU available for optional local AI' : 'WASM fallback available for optional local AI'}`);
        setAIDiagnostics({ lastResponseSource: state.lastResponseSource });
      }
    });
    localAIButton?.addEventListener('click', () => void enableLocalAI());
    speechSelect?.addEventListener('change', () => {
      state.speechMode = speechSelect.value;
      localStorage.setItem(SPEECH_KEY, state.speechMode);
      if (state.speechMode === 'local') setSpeechStatus('LOCAL_TRANSCRIPTION · model downloads on first use');
      else setEngine(`CALYPSO SPEECH · browser recognition${state.recognition ? '' : ' unavailable'}`);
      setState('IDLE');
    });
    state.customVoice = createPrivateCustomVoice({ onStatus: (label) => setEngine(`CALYPSO VOICE · ${label.replaceAll('_', ' ')}`) });
    if (state.customVoice.status === 'ARCHITECTURE_READY') setEngine(`DETERMINISTIC FALLBACK · ${hasWebGPU ? 'WebGPU available' : 'WebGPU unavailable'} · custom voice architecture ready`);
    if (state.intelligence === 'local') {
      if (localAIButton) { localAIButton.hidden = false; localAIButton.textContent = 'DOWNLOAD / ENABLE LOCAL AI'; }
      void enableLocalAI();
    } else if (localAIButton) localAIButton.hidden = true;
    if (state.speechMode === 'local') setState('IDLE');
  }

  setup();
  return { answerQuestion: groundedAnswer, submitQuestion, speak, state };
}
