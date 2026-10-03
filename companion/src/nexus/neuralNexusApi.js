/**
 * fetch() against the Neural Nexus process that is already serving.
 * Same routes the browser uses in avatarService.jsx. Not a second API.
 */

import {
  buildAmbientLookFormData,
  buildIdlePlayFormData,
  buildLookNowResumeFormData,
  buildSpokenTurnFormData,
  buildStopFormData,
  buildTypedChatFormData,
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

function notifyMessageFrames(onFrame, frames) {
  if (typeof onFrame !== "function") {
    return;
  }
  for (const frame of frames) {
    onFrame(frame);
  }
}

export async function streamMessageTurn({
  neuralNexusApiBaseUrl,
  apiKey,
  assistantId,
  formData,
  signal,
  onFrame,
  path = `/message/${encodeURIComponent(assistantId)}`,
}) {
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

  return readMessageTurnUntilDone(response.body.getReader(), onFrame);
}

// Read frames until the reply's done frame, then return the turn at once.
// After done the API keeps the stream open to name a new conversation for the
// web app's sidebar (two model calls, 4,981 ms measured 2026-10-02 on the
// first turn of a thread); the companion has the whole reply by then, so the
// rest of the stream is drained in the background instead of being waited on.
export async function readMessageTurnUntilDone(reader, onFrame) {
  const textDecoder = new TextDecoder();
  let pendingText = "";
  const frames = [];
  let replyIsDone = false;
  try {
    while (!replyIsDone) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      pendingText += textDecoder.decode(value, { stream: true });
      const consumed = consumeServerSentEventBuffer(pendingText);
      frames.push(...consumed.frames);
      notifyMessageFrames(onFrame, consumed.frames);
      pendingText = consumed.remaining;
      replyIsDone = consumed.frames.some((frame) => frame?.type === "done");
    }
    if (!replyIsDone && pendingText.trim()) {
      const consumed = consumeServerSentEventBuffer(`${pendingText}\n\n`);
      frames.push(...consumed.frames);
      notifyMessageFrames(onFrame, consumed.frames);
    }
  } catch (error) {
    reader.releaseLock();
    throw error;
  }
  if (replyIsDone) {
    drainRemainingFrames(reader, onFrame, textDecoder, pendingText);
  } else {
    reader.releaseLock();
  }
  return collectMessageTurnFromFrames(frames);
}

// Keep reading the frames sent after done (the conversation title), so the
// API finishes the request normally, without holding up the reply.
function drainRemainingFrames(reader, onFrame, textDecoder, pendingText) {
  (async () => {
    let remainingText = pendingText;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        remainingText += textDecoder.decode(value, { stream: true });
        const consumed = consumeServerSentEventBuffer(remainingText);
        notifyMessageFrames(onFrame, consumed.frames);
        remainingText = consumed.remaining;
      }
    } catch {
      // A stream cut off after the reply loses only the conversation title.
    } finally {
      reader.releaseLock();
    }
  })();
}

export function isLookNowInterrupt(turn) {
  return turn?.interrupt?.kind === "look_now";
}

export async function postLookNowResume(configuration, {
  threadId,
  screenshotBytes,
  requestedSources,
  signal,
  onFrame,
} = {}) {
  return streamMessageTurn({
    neuralNexusApiBaseUrl: configuration.neuralNexusApiBaseUrl,
    apiKey: configuration.apiKey,
    assistantId: configuration.assistantId,
    formData: buildLookNowResumeFormData({
      threadId,
      screenshotBytes,
      requestedSources,
      userTimezone: configuration.userTimezone,
      minecraftWorldSnapshot: configuration.minecraftWorldSnapshot,
    }),
    signal,
    onFrame,
    path: `/message/${encodeURIComponent(configuration.assistantId)}/resume`,
  });
}

export async function postSpokenTurn(configuration, {
  playPromptMessage,
  utteranceBytes,
  signal,
  onFrame,
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
      minecraftWorldSnapshot: configuration.minecraftWorldSnapshot,
    }),
    signal,
    onFrame,
  });
}

export async function postAmbientLook(configuration, {
  screenshotBytes,
  capturedAt,
  signal,
  onFrame,
  playPromptMessage = "",
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
      playPromptMessage,
    }),
    signal,
    onFrame,
  });
}

export async function postTypedChatTurn(configuration, {
  playPromptMessage,
  viewPictureBytes = null,
  signal,
  onFrame,
} = {}) {
  return streamMessageTurn({
    neuralNexusApiBaseUrl: configuration.neuralNexusApiBaseUrl,
    apiKey: configuration.apiKey,
    assistantId: configuration.assistantId,
    formData: buildTypedChatFormData({
      playPromptMessage,
      threadId: configuration.threadId,
      userTimezone: configuration.userTimezone,
      minecraftWorldSnapshot: configuration.minecraftWorldSnapshot,
      viewPictureBytes,
    }),
    signal,
    onFrame,
  });
}

export async function postIdlePlayTurn(configuration, {
  playPromptMessage,
  signal,
  onFrame,
} = {}) {
  return streamMessageTurn({
    neuralNexusApiBaseUrl: configuration.neuralNexusApiBaseUrl,
    apiKey: configuration.apiKey,
    assistantId: configuration.assistantId,
    formData: buildIdlePlayFormData({
      playPromptMessage,
      threadId: configuration.threadId,
      userTimezone: configuration.userTimezone,
      minecraftWorldSnapshot: configuration.minecraftWorldSnapshot,
    }),
    signal,
    onFrame,
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
