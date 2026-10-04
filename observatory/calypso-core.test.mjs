import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLocalMessages, buildMeshContext, extractGeneratedText, mapRecognitionError, renderSpeechText } from './calypso-core.mjs';
import { normalizeTranscriptText, resampleMono } from './calypso-local.js';

test('recognition errors stay explicit', () => {
  assert.equal(mapRecognitionError('network'), 'SPEECH_RECOGNITION_NETWORK_ERROR');
  assert.equal(mapRecognitionError('audio-capture'), 'AUDIO_CAPTURE_ERROR');
  assert.equal(mapRecognitionError('aborted'), 'ABORTED');
  assert.equal(mapRecognitionError('other'), 'UNKNOWN_SPEECH_ERROR');
});

test('mesh context is compact and does not dump the FOMO archive', () => {
  const result = { text: 'Three signals are available.', recordId: 'fomo-2', update: { sourceProject: 'FOMO', title: 'FOMO', summary: 'Three reports.', evidenceType: 'EXTERNAL_SOURCE', sourceType: 'REAL_WORLD', details: { recordCount: 1019, records: Array.from({ length: 1019 }, (_, index) => ({ id: `fomo-${index}`, title: `Report ${index}`, links: [] })) } } };
  const context = buildMeshContext({ question: 'show me FOMO', result, updates: [result.update], memory: [] });
  assert.equal(context.updates[0].records.length, 5);
  assert.equal(context.updates[0].recordCount, 1019);
  assert.equal(context.selectedRecordId, 'fomo-2');
  assert.equal(JSON.stringify(context).includes('Report 1000'), false);
});

test('local prompt preserves grounding rules', () => {
  const messages = buildLocalMessages({ answerCandidate: 'Fraud Watch is synthetic.', rules: { doNotInventEvidence: true } });
  assert.match(messages[0].content, /MESH is the only source of facts/);
  assert.match(messages[1].content, /doNotInventEvidence/);
});

test('speech rendering removes URLs and technical labels', () => {
  assert.equal(renderSpeechText('Open https://example.com. Evidence class: EXTERNAL_SOURCE. Hello.'), 'Open Hello.');
});

test('model output supports chat-shaped generation responses', () => {
  assert.equal(extractGeneratedText([{ generated_text: [{ role: 'assistant', content: 'Grounded answer.' }] }]), 'Grounded answer.');
});

test('local speech audio is resampled to Whisper input rate', () => {
  const source = new Float32Array([0, 1, 0, -1]);
  const result = resampleMono(source, 8000, 16000);
  assert.equal(result.length, 8);
  assert.equal(result[0], 0);
  assert.equal(result[2], 1);
  assert.equal(result[4], 0);
});

test('local speech treats Whisper silence sentinels as no speech', () => {
  assert.equal(normalizeTranscriptText('[BLANK_AUDIO]'), '');
  assert.equal(normalizeTranscriptText('real words'), 'real words');
});
