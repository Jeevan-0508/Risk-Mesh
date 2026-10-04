import { buildLocalMessages, extractGeneratedText, LOCAL_LLM_MODEL, LOCAL_STT_MODEL, looksUsableModelResponse } from './calypso-core.mjs';

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm';

function progressValue(event) {
  if (Number.isFinite(event?.progress)) return Math.max(0, Math.min(100, Math.round(event.progress)));
  if (Number.isFinite(event?.loaded) && Number.isFinite(event?.total) && event.total > 0) return Math.round((event.loaded / event.total) * 100);
  return null;
}

async function importTransformers() {
  return import(/* webpackIgnore: true */ TRANSFORMERS_URL);
}

export function createLocalIntelligence({ onStatus = () => {}, onProgress = () => {} } = {}) {
  const state = { generator: null, loading: null, ready: false, failed: null, device: null, latencyMs: null };

  async function load() {
    if (state.ready) return state;
    if (state.loading) return state.loading;
    state.loading = (async () => {
      onStatus('PREPARING_LOCAL_AI');
      const { pipeline } = await importTransformers();
      const webgpu = Boolean(globalThis.navigator?.gpu);
      const attempts = webgpu ? [['webgpu', 'q4'], ['wasm', 'q8']] : [['wasm', 'q8']];
      let lastError;
      for (const [device, dtype] of attempts) {
        try {
          state.device = `${device}/${dtype}`;
          onStatus(`DOWNLOADING_LOCAL_AI · ${device.toUpperCase()} · ${dtype.toUpperCase()}`);
          state.generator = await pipeline('text-generation', LOCAL_LLM_MODEL.id, {
            device,
            dtype,
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
      onStatus(`LOCAL_AI_READY · ${state.device}`);
      return state;
    })().catch((error) => {
      state.failed = error;
      state.loading = null;
      onStatus('LOCAL_AI_UNAVAILABLE');
      throw error;
    });
    return state.loading;
  }

  async function generate(meshContext) {
    await load();
    const started = performance.now();
    const output = await state.generator(buildLocalMessages(meshContext), {
      max_new_tokens: 128,
      do_sample: false,
      temperature: 0.2,
    });
    state.latencyMs = Math.round(performance.now() - started);
    const text = extractGeneratedText(output);
    if (!looksUsableModelResponse(text)) throw new Error('LOCAL_AI_EMPTY_RESPONSE');
    return { text, latencyMs: state.latencyMs, device: state.device };
  }

  return {
    state,
    model: LOCAL_LLM_MODEL,
    load,
    generate,
  };
}

export function createLocalTranscriber({ onStatus = () => {}, onProgress = () => {} } = {}) {
  const state = { transcriber: null, loading: null, ready: false, failed: null, device: null };

  async function load() {
    if (state.ready) return state;
    if (state.loading) return state.loading;
    state.loading = (async () => {
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
      onStatus(`LOCAL_STT_READY · ${device}`);
      return state;
    })().catch((error) => {
      state.failed = error;
      state.loading = null;
      onStatus('LOCAL_STT_UNAVAILABLE');
      throw error;
    });
    return state.loading;
  }

  async function transcribe(blob) {
    await load();
    const url = URL.createObjectURL(blob);
    try {
      const output = await state.transcriber(url, { language: 'english', task: 'transcribe' });
      return String(output?.text || '').trim();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return { state, model: LOCAL_STT_MODEL, load, transcribe };
}
