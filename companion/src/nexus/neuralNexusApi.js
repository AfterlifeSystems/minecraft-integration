/**
 * fetch() against the Neural Nexus process that is already serving.
 * Same routes the browser uses in avatarService.jsx. Not a second API.
 */

import {
  buildAmbientLookFormData,
  buildIdlePlayFormData,
  buildSpokenTurnFormData,
  buildStopFormData,
} from "./messageFormData.js";
import {
  collectMessageTurnFromFrames,
  consumeServerSentEventBuffer,
} from "./parseServerSentEvents.js";

function authenticationHeaders(apiKey) {
  return {
    "API-KEY": apiKey,
    Accept: "text/event-stream",
  };
}

async function raiseUnlessOk(response, path) {
  if (response.ok) {
    return;
  }
  const bodyText = await response.text();
  const error = new Error(
    `${path} returned ${response.status}: ${bodyText.slice(0, 500)}`
  );
  error.status = response.status;
  error.bodyText = bodyText;
  throw error;
}

export async function streamMessageTurn({
  neuralNexusApiBaseUrl,
  apiKey,
  assistantId,
  formData,
  signal,
}) {
  const path = `/message/${encodeURIComponent(assistantId)}`;
  const response = await fetch(`${neuralNexusApiBaseUrl}${path}`, {
    method: "POST",
    headers: authenticationHeaders(apiKey),
    body: formData,
    signal,
  });
  await raiseUnlessOk(response, path);
  if (!response.body) {
    throw new Error(`${path} returned no event stream.`);
  }

  const reader = response.body.getReader();
  const textDecoder = new TextDecoder();
  let pendingText = "";
  const frames = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      pendingText += textDecoder.decode(value, { stream: true });
      const consumed = consumeServerSentEventBuffer(pendingText);
      frames.push(...consumed.frames);
      pendingText = consumed.remaining;
    }
    if (pendingText.trim()) {
      const consumed = consumeServerSentEventBuffer(`${pendingText}\n\n`);
      frames.push(...consumed.frames);
    }
  } finally {
    reader.releaseLock();
  }
  return collectMessageTurnFromFrames(frames);
}

export async function postSpokenTurn(configuration, {
  playPromptMessage,
  utteranceBytes,
  signal,
} = {}) {
  return streamMessageTurn({
    neuralNexusApiBaseUrl: configuration.neuralNexusApiBaseUrl,
    apiKey: configuration.apiKey,
    assistantId: configuration.assistantId,
    formData: buildSpokenTurnFormData({
      playPromptMessage,
      utteranceBytes,
      threadId: configuration.threadId,
      userTimezone: configuration.userTimezone,
    }),
    signal,
  });
}

export async function postAmbientLook(configuration, {
  screenshotBytes,
  capturedAt,
  signal,
} = {}) {
  return streamMessageTurn({
    neuralNexusApiBaseUrl: configuration.neuralNexusApiBaseUrl,
    apiKey: configuration.apiKey,
    assistantId: configuration.assistantId,
    formData: buildAmbientLookFormData({
      screenshotBytes,
      threadId: configuration.threadId,
      userTimezone: configuration.userTimezone,
      capturedAt,
    }),
    signal,
  });
}

export async function postIdlePlayTurn(configuration, {
  playPromptMessage,
  signal,
} = {}) {
  return streamMessageTurn({
    neuralNexusApiBaseUrl: configuration.neuralNexusApiBaseUrl,
    apiKey: configuration.apiKey,
    assistantId: configuration.assistantId,
    formData: buildIdlePlayFormData({
      playPromptMessage,
      threadId: configuration.threadId,
      userTimezone: configuration.userTimezone,
    }),
    signal,
  });
}

export async function stopMessageTurn(configuration, { requestId, signal } = {}) {
  const path = `/message/${encodeURIComponent(configuration.assistantId)}/stop`;
  const response = await fetch(`${configuration.neuralNexusApiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "API-KEY": configuration.apiKey,
    },
    body: buildStopFormData({
      requestId,
      threadId: configuration.threadId,
    }),
    signal,
  });
  if (response.status === 404) {
    return { status: "already_finished" };
  }
  await raiseUnlessOk(response, path);
  return response.json().catch(() => ({ status: "stopping" }));
}

export async function speakText(configuration, text, { signal } = {}) {
  const path = "/speak";
  const response = await fetch(`${configuration.neuralNexusApiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "API-KEY": configuration.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistant_id: configuration.assistantId,
      text,
    }),
    signal,
  });
  if (response.status === 409) {
    return { audioBytes: null, voiceKind: null, blocked: true };
  }
  await raiseUnlessOk(response, path);
  const audioBytes = Buffer.from(await response.arrayBuffer());
  return {
    audioBytes,
    voiceKind: response.headers.get("X-Voice-Kind"),
    blocked: false,
  };
}
