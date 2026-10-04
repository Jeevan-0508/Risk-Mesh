export const LOCAL_LLM_MODEL = {
  id: 'onnx-community/Qwen2.5-0.5B-Instruct',
  label: 'Qwen2.5 0.5B Instruct · q4f16/WebGPU or q8/WASM',
  parameters: '0.5B',
};

export const LOCAL_STT_MODEL = {
  id: 'onnx-community/whisper-tiny.en',
  label: 'Whisper tiny.en · browser-local transcription',
  parameters: '39M',
};

export function mapRecognitionError(code) {
  return ({
    'not-allowed': 'MICROPHONE_PERMISSION_DENIED',
    'service-not-allowed': 'MICROPHONE_PERMISSION_DENIED',
    'no-speech': 'NO_SPEECH_DETECTED',
    'audio-capture': 'AUDIO_CAPTURE_ERROR',
    network: 'SPEECH_RECOGNITION_NETWORK_ERROR',
    aborted: 'ABORTED',
  })[code] || 'UNKNOWN_SPEECH_ERROR';
}

export function renderSpeechText(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\b(?:MESH timestamp|Evidence class|Freshness):[^.]+\.?/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
}

function compactRecord(record) {
  return {
    id: record?.id,
    title: record?.title,
    summary: record?.summary,
    category: record?.category,
    severity: record?.severity,
    location: record?.location,
    classification: 'REAL_WORLD_SIGNAL',
    links: (record?.links || []).map((item) => ({ label: item.label, url: item.url })),
  };
}

function compactUpdate(update) {
  if (!update) return null;
  const details = update.details || {};
  return {
    sourceProject: update.sourceProject,
    title: update.title,
    summary: update.summary,
    evidenceType: update.evidenceType,
    sourceType: update.sourceType,
    status: update.status,
    timestamp: update.timestamp,
    newCount: details.newCount,
    recordCount: details.recordCount,
    records: Array.isArray(details.records) ? details.records.slice(0, 5).map(compactRecord) : undefined,
  };
}

export function buildMeshContext({ question, result, updates = [], memory = [] }) {
  const relevant = result?.update ? [result.update] : [];
  const sourceNames = [...new Set([
    ...relevant.map((item) => item?.sourceProject),
    ...updates.filter((item) => item?.status === 'UNAVAILABLE').map((item) => item.sourceProject),
  ].filter(Boolean))];
  return {
    question: String(question || '').slice(0, 500),
    answerCandidate: String(result?.text || '').slice(0, 1600),
    selectedRecordId: result?.recordId || null,
    updates: relevant.map(compactUpdate),
    sources: sourceNames.map((name) => {
      const update = updates.find((item) => item.sourceProject === name);
      return compactUpdate(update) || { sourceProject: name };
    }),
    conversation: memory.slice(-6).map((item) => ({ question: item.question, answer: item.answer })),
    rules: {
      doNotInventEvidence: true,
      distinguishSynthetic: true,
      admitUnknown: true,
      meshOwnsFacts: true,
    },
  };
}

export function buildLocalMessages(meshContext) {
  return [
    {
      role: 'system',
      content: 'You are Calypso, a warm, concise risk briefing companion. MESH is the only source of facts. Rewrite the supplied answer candidate naturally, using only the supplied evidence. Never add a record, number, location, event, source, or certainty. Preserve REAL_WORLD_SIGNAL versus SYNTHETIC, OFFICIAL, SNAPSHOT, UNAVAILABLE, and STALE distinctions. If the evidence is missing or unavailable, say so plainly. Do not mention being a language model, do not invent current events, and keep the answer under 90 words.',
    },
    {
      role: 'user',
      content: JSON.stringify(meshContext),
    },
  ];
}

export function extractGeneratedText(output) {
  const value = Array.isArray(output) ? output[0]?.generated_text : output?.generated_text;
  if (Array.isArray(value)) return String(value.at(-1)?.content || '').trim();
  return String(value || '').trim();
}

export function looksUsableModelResponse(text) {
  const value = String(text || '').trim();
  return value.length >= 2 && value.length <= 1200 && !/^\[?object Object\]?$/i.test(value);
}
