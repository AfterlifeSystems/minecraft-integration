export const VOICE_SAMPLE_RATE = 48000;
export const MAXIMUM_UTTERANCE_PCM_BYTES = VOICE_SAMPLE_RATE * 2 * 8;
export const MINIMUM_SPEECH_DURATION_SECONDS = 0.45;
export const MINIMUM_SPEECH_RMS = 35;
export const MINIMUM_SPEECH_PEAK = 200;

export function isOtherPlayerVoiceEvent(event, avatarUsername) {
  const senderName = String(event?.sender || "").trim();
  const avatarName = String(avatarUsername || "").trim();
  if (!senderName) {
    return false;
  }
  if (!avatarName) {
    return true;
  }
  return senderName.toLowerCase() !== avatarName.toLowerCase();
}

export function pcmSpeechEnergy(pcmBytes) {
  const pcm = Buffer.from(pcmBytes || []);
  const sampleCount = Math.floor(pcm.length / 2);
  if (sampleCount < 1) {
    return { rms: 0, peak: 0, sampleCount: 0 };
  }
  let sumSquares = 0;
  let peak = 0;
  for (let offset = 0; offset + 1 < pcm.length; offset += 2) {
    const sample = pcm.readInt16LE(offset);
    const magnitude = Math.abs(sample);
    if (magnitude > peak) {
      peak = magnitude;
    }
    sumSquares += sample * sample;
  }
  return {
    rms: Math.sqrt(sumSquares / sampleCount),
    peak,
    sampleCount,
  };
}

export function pcmMeetsSpeechThreshold(pcmBytes) {
  const energy = pcmSpeechEnergy(pcmBytes);
  const durationSeconds = energy.sampleCount / VOICE_SAMPLE_RATE;
  return {
    ...energy,
    durationSeconds,
    accepted:
      durationSeconds >= MINIMUM_SPEECH_DURATION_SECONDS &&
      energy.rms >= MINIMUM_SPEECH_RMS &&
      energy.peak >= MINIMUM_SPEECH_PEAK,
  };
}

export function isCompanionOwnVoiceEvent(event, avatarUsername) {
  const senderName = String(event?.sender || "").trim();
  const avatarName = String(avatarUsername || "").trim();
  if (!senderName || !avatarName) {
    return false;
  }
  return senderName.toLowerCase() === avatarName.toLowerCase();
}

export function isAbortError(error) {
  return (
    error?.name === "AbortError" ||
    /aborted/i.test(String(error?.message || ""))
  );
}

export function rememberTurnStartedFrame(frame, configuration) {
  if (!frame || typeof frame !== "object") {
    return configuration;
  }
  if (frame.type !== "turn_started" && frame.type !== "done") {
    return configuration;
  }
  if (frame.request_id) {
    configuration.lastRequestId = frame.request_id;
  }
  if (frame.thread_id) {
    configuration.threadId = frame.thread_id;
  }
  return configuration;
}
