const VOICE_KEY = 'risk-mesh:calypso-voice-uri-v1';

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
    recognitionSession: null,
    memory: [],
    context: null,
  };

  const response = $('mesh-response');
  const question = $('mesh-question');
  const voiceButton = $('mesh-voice-input');
  const voiceToggle = $('calypso-voice-toggle');
  const voiceSelect = $('calypso-voice-select');
  const stopButton = $('calypso-stop-speaking');
  const transcript = $('calypso-transcript');
  const error = $('calypso-error');
  const stateLabel = $('calypso-state');
  const engineLabel = $('calypso-engine');

  function setState(next, errorCode = '') {
    state.status = next;
    if (stateLabel) {
      stateLabel.textContent = `CALYPSO ● ${next}`;
      stateLabel.dataset.state = next;
    }
    if (error) error.textContent = errorCode ? errorCode : '';
    if (voiceButton) {
      voiceButton.textContent = next === 'LISTENING' ? 'Listening…' : next === 'SPEAKING' ? 'Calypso is speaking…' : 'Talk to Calypso';
      voiceButton.dataset.state = next;
      voiceButton.disabled = !state.recognition && next !== 'SPEAKING';
    }
    if (next === 'LISTENING' || next === 'SPEAKING' || next === 'THINKING') onActivateSource?.(`calypso-${next.toLowerCase()}`);
  }

  function setTranscript(value, kind = '') {
    if (!transcript) return;
    transcript.textContent = value ? `${kind ? `${kind}: ` : ''}${value}` : 'Transcript will appear here.';
    transcript.dataset.kind = kind;
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
    if (result.update?.sourceProject === 'FOMO') {
      state.context = { source: 'FOMO', records: fomoRecords(result.update), update: result.update };
    }
  }

  function recordName(record, index) {
    return record?.title || `FOMO report ${index + 1}`;
  }

  function groundedAnswer(rawQuestion) {
    const text = String(rawQuestion || '').trim();
    const q = classifyQuestion(text);
    if (!q) return { text: 'Ask me about the briefing, a source, evidence, or one of the FOMO reports.' };

    if (/^(hi|hello|hey|good morning|good afternoon)\b/.test(q)) {
      return { text: 'Hello, Jeevan. I’m Calypso. What would you like to inspect?' };
    }

    const fomo = fomoUpdate();
    const records = fomoRecords(fomo);
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

    const ordinal = q.match(/\b(the\s+)?(first|second|third|fourth|fifth)\s+one\b/);
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
      return { text: 'MESH keeps the evidence classes separate: FOMO is REAL_WORLD external-source data in a repository snapshot; Fraud Watch, Shadow Network, and Risk Ring are SYNTHETIC simulations; EU AI Act Scanner and Forecast Ledger use OFFICIAL sources or data; Reg Search is a cited SNAPSHOT.' };
    }

    if (/fraud\s*watch/.test(q)) {
      const update = sourceUpdate('Fraud Watch');
      return update ? { text: `Fraud Watch found ${update.summary.replace(/^Synthetic\s*/i, '').replace(/\.$/, '')}. It is SYNTHETIC SIMULATION data, not real-world fraud evidence.`, update } : { text: 'Fraud Watch has no completed update in the current snapshot.' };
    }

    if (/(funny|scary|anything interesting)/.test(q)) {
      const update = fomo;
      const count = Number(update?.details?.newCount || 0);
      return { text: `Nothing I’d call apocalyptic. ${count ? `FOMO did flag ${count} new external signal${count === 1 ? '' : 's'} worth inspecting.` : 'The current snapshot does not show a new FOMO signal.'} The remaining findings stay clearly labelled by MESH.`, update };
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
      if (update) return { text: `I found the ${matched.name} evidence. I’ll open its grounded details and source links.`, update };
      if (matched) return { text: `${matched.name} has no new update in the current briefing. Its status is ${matched.status}; the source chip still exposes its provenance.` };
    }

    const matched = briefing.sources.find((source) => q.includes(source.name.toLowerCase()) || q.includes(source.id));
    if (matched) {
      const update = sourceUpdate(matched.name);
      return update ? { text: `${matched.name}: ${update.summary} Evidence class: ${update.evidenceType}. Freshness: ${matched.freshness}.`, update } : { text: `${matched.name} has no new update in the completed check. Status: ${matched.status}. Freshness: ${matched.freshness}.` };
    }

    return { text: 'I can help inspect what changed, FOMO reports and links, evidence, freshness, real versus synthetic data, or the current status of Fraud Watch, Shadow Network, EU AI monitoring, Risk Ring, Forecast Ledger, and Reg Search.' };
  }

  function showLinks(links = []) {
    renderConversationLinks?.(links);
  }

  function speak(text) {
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined') {
      setState('IDLE', 'SPEECH_SYNTHESIS_UNAVAILABLE');
      return false;
    }
    const utterance = new SpeechSynthesisUtterance(cleanForSpeech(text));
    const selected = state.voices.find((voice) => voice.voiceURI === state.selectedVoice) || state.voices[0];
    if (selected) utterance.voice = selected;
    utterance.lang = selected?.lang || 'en-US';
    utterance.rate = 0.96;
    utterance.pitch = 1.02;
    utterance.onstart = () => setState('SPEAKING');
    utterance.onend = () => setState('IDLE');
    utterance.oncancel = () => setState('IDLE');
    utterance.onerror = (event) => setState('IDLE', `SPEECH_SYNTHESIS_${String(event.error || 'ERROR').toUpperCase()}`);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return true;
  }

  function submitQuestion(rawQuestion, { speakResponse = false, fromVoice = false } = {}) {
    const text = String(rawQuestion || '').trim();
    if (!text) {
      setState('IDLE', 'NO_TRANSCRIPT');
      return;
    }
    setState('THINKING');
    const result = groundedAnswer(text);
    remember(text, result);
    if (response) response.textContent = result.text;
    showLinks(result.links || []);
    if (result.update) onOpenEvidence?.(result.update, result.recordId);
    if (fromVoice) setTranscript(text, 'FINAL');
    if (speakResponse && state.voiceOn) speak(result.text);
    else setState('IDLE');
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
    if (engineLabel) engineLabel.textContent = `DETERMINISTIC FALLBACK · ${state.voices.length} compatible voice${state.voices.length === 1 ? '' : 's'} · no local model installed`;
  }

  function mapRecognitionError(code) {
    return ({
      'not-allowed': 'MICROPHONE_PERMISSION_DENIED',
      'service-not-allowed': 'MICROPHONE_PERMISSION_DENIED',
      'no-speech': 'NO_SPEECH_DETECTED',
      'audio-capture': 'MICROPHONE_UNAVAILABLE',
      network: 'SPEECH_RECOGNITION_NETWORK_ERROR',
    })[code] || `SPEECH_RECOGNITION_${String(code || 'ERROR').toUpperCase()}`;
  }

  function setupRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setState('IDLE', 'SPEECH_RECOGNITION_UNAVAILABLE');
      if (voiceButton) voiceButton.disabled = true;
      return;
    }
    state.recognition = new Recognition();
    state.recognition.continuous = false;
    state.recognition.interimResults = true;
    state.recognition.maxAlternatives = 1;
    state.recognition.lang = 'en-US';
    state.recognition.onstart = () => {
      state.recognitionSession = { finalText: '', errorCode: '', submitted: false };
      setTranscript('', '');
      setState('LISTENING');
    };
    state.recognition.onresult = (event) => {
      let interim = '';
      let finalText = state.recognitionSession?.finalText || '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const phrase = event.results[index][0]?.transcript || '';
        if (event.results[index].isFinal) finalText += `${phrase} `;
        else interim += phrase;
      }
      if (state.recognitionSession) state.recognitionSession.finalText = finalText.trim();
      setTranscript((finalText || interim).trim(), finalText ? 'FINAL' : 'LIVE');
      if (finalText) setState('HEARD');
    };
    state.recognition.onerror = (event) => {
      if (state.recognitionSession) state.recognitionSession.errorCode = mapRecognitionError(event.error);
      setState('IDLE', mapRecognitionError(event.error));
    };
    state.recognition.onend = () => {
      const session = state.recognitionSession;
      if (!session) return;
      if (session.finalText && !session.submitted && !session.errorCode) {
        session.submitted = true;
        submitQuestion(session.finalText, { speakResponse: true, fromVoice: true });
      } else if (!session.finalText && !session.errorCode) {
        setState('IDLE', 'NO_SPEECH_DETECTED');
      }
    };
  }

  function startListening() {
    if (!state.recognition) {
      setState('IDLE', 'SPEECH_RECOGNITION_UNAVAILABLE');
      return;
    }
    if (state.status === 'LISTENING') {
      state.recognition.stop();
      return;
    }
    if (state.status === 'SPEAKING') window.speechSynthesis.cancel();
    try {
      state.recognition.start();
    } catch (caught) {
      setState('IDLE', `SPEECH_RECOGNITION_${String(caught?.name || 'ERROR').toUpperCase()}`);
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
    if (engineLabel) engineLabel.textContent = `DETERMINISTIC FALLBACK · local model not installed · ${hasWebGPU ? 'WebGPU available for future opt-in' : 'WebGPU unavailable'}`;
    loadVoices();
    if ('speechSynthesis' in window) window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    setupRecognition();
    if (state.recognition) setState('IDLE');
    setupMicrophonePermissionState();
    voiceButton?.addEventListener('click', startListening);
    $('mesh-ask')?.addEventListener('click', () => submitQuestion(question?.value || ''));
    question?.addEventListener('keydown', (event) => { if (event.key === 'Enter') submitQuestion(question.value || ''); });
    $('mesh-brief')?.addEventListener('click', () => submitQuestion("What's new today?", { speakResponse: true }));
    voiceToggle?.addEventListener('click', () => {
      if (!('speechSynthesis' in window)) { setState('IDLE', 'SPEECH_SYNTHESIS_UNAVAILABLE'); return; }
      state.voiceOn = !state.voiceOn;
      voiceToggle.textContent = state.voiceOn ? 'VOICE ON' : 'VOICE OFF';
      if (!state.voiceOn) window.speechSynthesis.cancel();
    });
    stopButton?.addEventListener('click', () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setState('IDLE');
    });
    voiceSelect?.addEventListener('change', () => {
      state.selectedVoice = voiceSelect.value;
      localStorage.setItem(VOICE_KEY, state.selectedVoice);
    });
  }

  setup();
  return { answerQuestion: groundedAnswer, submitQuestion, speak, state };
}
