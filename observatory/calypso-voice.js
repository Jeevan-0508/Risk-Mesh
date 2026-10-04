function configuredEndpoint() {
  const config = globalThis.CALYPSO_CUSTOM_VOICE_CONFIG;
  return config && typeof config.endpoint === 'string' && config.endpoint.startsWith('https://') ? config : null;
}

export function createPrivateCustomVoice({ onStatus = () => {} } = {}) {
  let audio = null;
  const config = configuredEndpoint();

  async function speak(text, { signal } = {}) {
    if (!config) {
      onStatus('ARCHITECTURE_READY · PRIVATE TTS BACKEND REQUIRED');
      return false;
    }
    onStatus('CUSTOM_VOICE_REQUEST');
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(config.headers || {}) },
      body: JSON.stringify({ text, voice: config.voice || 'calypso' }),
      signal,
    });
    if (!response.ok) throw new Error(`CUSTOM_TTS_HTTP_${response.status}`);
    const blob = await response.blob();
    audio = new Audio(URL.createObjectURL(blob));
    audio.onended = () => { URL.revokeObjectURL(audio.src); audio = null; onStatus('CUSTOM_VOICE_IDLE'); };
    await audio.play();
    onStatus('CUSTOM_VOICE_SPEAKING');
    return true;
  }

  function stop() {
    if (!audio) return;
    audio.pause();
    URL.revokeObjectURL(audio.src);
    audio = null;
    onStatus('CUSTOM_VOICE_IDLE');
  }

  return {
    configured: Boolean(config),
    status: config ? 'CONFIGURED_PRIVATE_ENDPOINT' : 'ARCHITECTURE_READY',
    speak,
    stop,
  };
}
