import { buildLocalMessages, extractGeneratedText, LOCAL_LLM_MODEL, LOCAL_STT_MODEL, looksUsableModelResponse } from './calypso-core.mjs?v=3';

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm';
const TRANSFORMERS_VERSION = '3.8.1';

function progressValue(event) {
  if (Number.isFinite(event?.progress)) return Math.max(0, Math.min(100, Math.round(event.progress)));
  if (Number.isFinite(event?.loaded) && Number.isFinite(event?.total) && event.total > 0) return Math.round((event.loaded / event.total) * 100);
  return null;
}

async function importTransformers() {
  return import(/* webpackIgnore: true */ TRANSFORMERS_URL);
}

export function createLocalIntelligence({ onStatus = () => {}, onProgress = () => {}, onDiagnostic = () => {} } = {}) {
  const state = {
    generator: null,
    loading: null,
    ready: false,
    failed: null,
    device: null,
    latencyMs: null,
    status: 'NOT_DOWNLOADED',
    transformersLoaded: false,
    modelDownloadState: 'NOT_STARTED',
    modelInitializationState: 'NOT_STARTED',
    pipelineState: 'NOT_INITIALIZED',
    lastInferenceBackend: null,
    lastInferenceMs: null,
    lastResponseSource: null,
    lastError: null,
    controlledTest: 'NOT_RUN',
  };

  function diagnostics() {
    return {
      mode: 'LOCAL_AI',
      model: LOCAL_LLM_MODEL.id,
      transformersVersion: TRANSFORMERS_VERSION,
      backend: state.device || 'NOT_SELECTED',
      webgpuAvailable: Boolean(globalThis.navigator?.gpu),
      wasmAvailable: typeof globalThis.WebAssembly !== 'undefined',
      status: state.status,
      modelDownloadState: state.modelDownloadState,
      modelInitializationState: state.modelInitializationState,
      pipelineState: state.pipelineState,
      lastInferenceBackend: state.lastInferenceBackend || 'NOT_RUN',
      lastInferenceDuration: state.lastInferenceMs == null ? 'NOT_RUN' : `${state.lastInferenceMs}ms`,
      lastResponseSource: state.lastResponseSource || 'NOT_RUN',
      lastError: state.lastError || 'NONE',
      controlledTest: state.controlledTest,
    };
  }

  function report() {
    onDiagnostic(diagnostics());
  }

  function setStatus(status, label = status) {
    state.status = status;
    onStatus(label);
    report();
  }

  async function verify(generator, device) {
    const started = performance.now();
    const output = await generator([
      { role: 'user', content: 'Reply with exactly: CALYPSO_LOCAL_MODEL_TEST_OK' },
    ], { max_new_tokens: 24, do_sample: false });
    const text = extractGeneratedText(output);
    state.lastInferenceBackend = device;
    state.lastInferenceMs = Math.round(performance.now() - started);
    state.controlledTest = text.includes('CALYPSO_LOCAL_MODEL_TEST_OK') ? 'PASSED' : `FAILED · ${text || 'empty output'}`;
    report();
    if (state.controlledTest !== 'PASSED') throw new Error(`LOCAL_AI_CONTROLLED_TEST_FAILED: ${text || 'empty output'}`);
  }

  async function load() {
    if (state.ready) return state;
    if (state.loading) return state.loading;
    state.loading = (async () => {
      state.lastError = null;
      state.modelDownloadState = 'NOT_STARTED';
      state.modelInitializationState = 'NOT_STARTED';
      state.pipelineState = 'NOT_INITIALIZED';
      setStatus('LOADING', 'PREPARING_LOCAL_AI');
      const { pipeline } = await importTransformers();
      state.transformersLoaded = true;
      const webgpu = Boolean(globalThis.navigator?.gpu);
      const attempts = webgpu ? [['webgpu', 'q4f16'], ['wasm', 'q8']] : [['wasm', 'q8']];
      let lastError;
      for (const [device, dtype] of attempts) {
        try {
          state.device = `${device}/${dtype}`;
          state.modelDownloadState = 'DOWNLOADING';
          state.modelInitializationState = 'LOADING';
          state.pipelineState = 'INITIALIZING';
          setStatus('INITIALIZING', `DOWNLOADING_LOCAL_AI · ${device.toUpperCase()} · ${dtype.toUpperCase()}`);
          state.generator = await pipeline('text-generation', LOCAL_LLM_MODEL.id, {
            device,
            dtype,
            progress_callback: (event) => onProgress(progressValue(event), event),
          });
          state.modelDownloadState = 'LOADED';
          state.modelInitializationState = 'READY';
          state.pipelineState = 'READY';
          setStatus('TESTING', 'TESTING_LOCAL_AI');
          await verify(state.generator, state.device);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          state.lastError = errorMessage(error);
          state.modelInitializationState = 'ERROR';
          state.pipelineState = 'ERROR';
          try { await state.generator?.dispose?.(); } catch { /* try the next backend */ }
          state.generator = null;
          report();
        }
      }
      if (lastError) throw lastError;
      state.ready = true;
      state.failed = null;
      state.lastError = null;
      setStatus('READY', `LOCAL_AI_READY · ${state.device}`);
      return state;
    })().catch((error) => {
      state.failed = error;
      state.ready = false;
      state.loading = null;
      state.status = 'ERROR';
      if (state.modelDownloadState === 'DOWNLOADING') state.modelDownloadState = 'ERROR';
      state.lastError = errorMessage(error);
      onStatus('LOCAL_AI_ERROR');
      report();
      throw error;
    });
    return state.loading;
  }

  async function generate(meshContext) {
    await load();
    if (!state.ready || !state.generator) throw new Error('LOCAL_AI_NOT_READY');
    const started = performance.now();
    try {
      const output = await state.generator(buildLocalMessages(meshContext), {
        max_new_tokens: 128,
        do_sample: false,
        temperature: 0.2,
      });
      state.latencyMs = Math.round(performance.now() - started);
      state.lastInferenceMs = state.latencyMs;
      state.lastInferenceBackend = state.device;
      state.lastResponseSource = 'LOCAL_LLM';
      const text = extractGeneratedText(output);
      if (!looksUsableModelResponse(text)) throw new Error('LOCAL_AI_EMPTY_RESPONSE');
      state.lastError = null;
      report();
      return { text, latencyMs: state.latencyMs, device: state.device, responseSource: 'LOCAL_LLM' };
    } catch (error) {
      state.lastError = errorMessage(error);
      report();
      throw error;
    }
  }

  async function dispose() {
    try { await state.generator?.dispose?.(); } catch { /* best-effort browser memory release */ }
    state.generator = null;
    state.ready = false;
    state.loading = null;
    state.status = 'NOT_DOWNLOADED';
    state.pipelineState = 'NOT_INITIALIZED';
    state.modelInitializationState = 'NOT_STARTED';
    state.lastResponseSource = null;
    report();
  }

  return {
    state,
    model: LOCAL_LLM_MODEL,
    diagnostics,
    load,
    generate,
    dispose,
  };
}

function errorMessage(error) {
  return String(error?.message || error || 'Unknown local speech error').replace(/\s+/g, ' ').trim();
}

export function normalizeTranscriptText(value) {
  const text = String(value || '').trim();
  return /^(?:\[blank_audio\]|\[silence\]|\[no speech detected\])$/i.test(text) ? '' : text;
}

export function resampleMono(samples, inputRate, outputRate = 16000) {
  if (!(samples instanceof Float32Array)) samples = Float32Array.from(samples || []);
  if (!samples.length || inputRate === outputRate) return samples;
  const ratio = inputRate / outputRate;
  const output = new Float32Array(Math.max(1, Math.round(samples.length / ratio)));
  for (let index = 0; index < output.length; index += 1) {
    const position = index * ratio;
    const left = Math.min(samples.length - 1, Math.floor(position));
    const right = Math.min(samples.length - 1, left + 1);
    const fraction = position - left;
    output[index] = samples[left] + ((samples[right] - samples[left]) * fraction);
  }
  return output;
}

async function decodeAndResample(blob, outputRate, onDiagnostic) {
  const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextCtor) throw new Error('AUDIO_DECODE_UNAVAILABLE');
  const audioContext = new AudioContextCtor();
  try {
    const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer());
    const mono = new Float32Array(decoded.length);
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const data = decoded.getChannelData(channel);
      for (let index = 0; index < decoded.length; index += 1) mono[index] += data[index] / decoded.numberOfChannels;
    }
    const samples = resampleMono(mono, decoded.sampleRate, outputRate);
    onDiagnostic('AUDIO DECODE', `input=${decoded.sampleRate}Hz/${decoded.numberOfChannels}ch output=${outputRate}Hz samples=${samples.length}`);
    return { data: samples, sampling_rate: outputRate };
  } finally {
    await audioContext.close().catch(() => {});
  }
}

export function createLocalTranscriber({ onStatus = () => {}, onProgress = () => {}, onDiagnostic = () => {} } = {}) {
  const state = { transcriber: null, loading: null, ready: false, failed: null, device: null };

  async function load() {
    if (state.ready) return state;
    if (state.loading) return state.loading;
    state.loading = (async () => {
      onDiagnostic('WHISPER LOAD', `loading ${LOCAL_STT_MODEL.id}`);
      onStatus('PREPARING_LOCAL_STT');
      const { pipeline } = await importTransformers();
      const webgpu = Boolean(globalThis.navigator?.gpu);
      const attempts = webgpu ? ['webgpu', 'wasm'] : ['wasm'];
      let lastError;
      for (const device of attempts) {
        try {
          state.device = device;
          onStatus(`DOWNLOADING_LOCAL_STT · ${device.toUpperCase()}`);
          state.transcriber = await pipeline('automatic-speech-recognition', LOCAL_STT_MODEL.id, {
            device,
            progress_callback: (event) => onProgress(progressValue(event), event),
          });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (lastError) throw lastError;
      state.ready = true;
      state.failed = null;
      onDiagnostic('WHISPER READY', `${LOCAL_STT_MODEL.id} · ${state.device}`);
      onStatus(`LOCAL_STT_READY · ${state.device}`);
      return state;
    })().catch((error) => {
      state.failed = error;
      state.loading = null;
      onDiagnostic('WHISPER LOAD', `error=${errorMessage(error)}`);
      onStatus('LOCAL_STT_UNAVAILABLE');
      throw error;
    });
    return state.loading;
  }

  async function transcribe(blob) {
    if (!(blob instanceof Blob) || blob.size === 0) throw new Error('EMPTY_AUDIO_CAPTURE');
    await load();
    if (!state.ready || !state.transcriber) throw new Error('LOCAL_STT_NOT_READY');
    onDiagnostic('TRANSCRIBING', `blob=${blob.size} bytes`);
    try {
      const audio = await decodeAndResample(blob, 16000, onDiagnostic);
      onDiagnostic('TRANSCRIBING', `samples=${audio.data.length} sampleRate=${audio.sampling_rate}`);
      const output = await state.transcriber(audio.data, { sampling_rate: audio.sampling_rate });
      const text = normalizeTranscriptText(output?.text);
      onDiagnostic('TRANSCRIPT RESULT', text ? `text=${text}` : 'empty');
      return text;
    } catch (error) {
      const message = errorMessage(error);
      onDiagnostic('TRANSCRIPT RESULT', `error=${message}`);
      throw new Error(`LOCAL_STT_ERROR: ${message}`);
    }
  }

  async function dispose() {
    try { await state.transcriber?.dispose?.(); } catch { /* best-effort browser memory release */ }
    state.transcriber = null;
    state.ready = false;
    state.loading = null;
    state.device = null;
  }

  return { state, model: LOCAL_STT_MODEL, load, transcribe, dispose };
}
