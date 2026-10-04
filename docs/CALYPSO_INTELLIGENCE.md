# CALYPSO intelligence and private voice boundary

CALYPSO is the conversation layer. MESH remains the source of truth and supplies the compact evidence context. A browser-local model may rewrite a deterministic, grounded answer, but it never retrieves facts or receives the full FOMO archive.

## Optional local AI

The Observatory does not download a model on first load. The user must choose `Local AI` and press `DOWNLOAD / ENABLE LOCAL AI`.

The current browser adapter targets `onnx-community/Qwen2.5-0.5B-Instruct` through the pinned Transformers.js `3.8.1` ESM build. It requests `q4` on WebGPU and `q8` on WASM. The model is roughly 0.5B parameters; the exact first-download size is reported by the model files as they stream and is not hard-coded. Cached browser model assets are reused by the runtime.

If loading or generation fails, the response remains the deterministic Calypso answer and the UI says `DETERMINISTIC FALLBACK`. No frontend API key or token is used.

## Optional local speech input

Browser `SpeechRecognition`/`webkitSpeechRecognition` remains the default push-to-talk path. If the browser reports a remote recognition network error, the user can select `Local transcription`. The fallback lazy-loads `onnx-community/whisper-tiny.en` through Transformers.js and records only while the push-to-talk control is held/toggled. It uses WebGPU when available and otherwise WASM. Initial Observatory startup never loads Whisper.

The fallback is intentionally not reported as working until a browser has downloaded the model and successfully transcribed a real microphone recording.

## Custom voice boundary

The repository contains only the adapter contract in `observatory/calypso-voice.js`. It supports a private HTTPS TTS endpoint through a runtime-only `window.CALYPSO_CUSTOM_VOICE_CONFIG` object. Credentials must be supplied by a private backend or authenticated session; they must not be placed in GitHub Pages JavaScript.

The custom voice adapter is therefore `ARCHITECTURE READY` unless a private backend is configured and an authorized voice model has actually generated and played audio. Browser speech synthesis remains the fallback, with the selected installed voice persisted locally.

The owner’s reference recording, derived WAV/audio, embeddings, model weights, and private configuration belong under the ignored `private-voice/` directory if supplied locally. None of those files are present in this repository or should be uploaded to GitHub Pages or an unapproved third party.

## Evidence contract

The local model receives:

- the user’s question;
- the deterministic answer candidate;
- the matching source update and at most five relevant FOMO records;
- bounded conversation memory;
- explicit rules to admit unknowns and preserve REAL_WORLD, SYNTHETIC, OFFICIAL, SNAPSHOT, UNAVAILABLE, and STALE classifications.

It never receives all 1,019 FOMO records. FOMO original links remain UI evidence links and are never read aloud as URLs.

Implementation references: [Transformers.js quantized model guide](https://huggingface.co/docs/transformers.js/en/guides/dtypes), [Transformers.js WebGPU guide](https://github.com/huggingface/transformers.js/blob/main/packages/transformers/docs/source/guides/webgpu.md), and [automatic speech recognition pipeline docs](https://huggingface.co/docs/transformers.js/api/pipelines).
