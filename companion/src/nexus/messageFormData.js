/**
 * Multipart bodies for the serving Neural Nexus API.
 * Field names match api-1.json Body_message_avatar_message__assistant_id__post
 * and Neural-Nexus-Frontend avatarService.jsx.
 */

function asBlob(value, mimeType) {
  if (value instanceof Blob) {
    return value;
  }
  return new Blob([value], { type: mimeType });
}

// The first-person Minecraft view is always available. Anubis only attaches
// look_now when a turn reports live_shares; "what do you see" is the webcam,
// and ambient looks already ride as screen.jpg.
export const LIVE_MINECRAFT_SHARES = '["webcam","screen"]';

function appendLiveMinecraftShares(formData) {
  formData.append("live_shares", LIVE_MINECRAFT_SHARES);
}

export function lookNowFileName(sourceName) {
  return sourceName === "webcam" ? "webcam.jpg" : "screen.jpg";
}

export function requestedLookSources(interruptSources) {
  const names = (Array.isArray(interruptSources) ? interruptSources : [])
    .map((source) => String(source || "").trim().toLowerCase())
    .filter((source) => source === "webcam" || source === "screen");
  if (names.length) {
    return [...new Set(names)];
  }
  return ["webcam", "screen"];
}

export function buildSpokenTurnFormData({
  playPromptMessage = "",
  utteranceBytes,
  utteranceFileName = "utterance.wav",
  threadId,
  userTimezone,
} = {}) {
  const formData = new FormData();
  formData.append("message", playPromptMessage ?? "");
  formData.append("stream", "true");
  formData.append("diarize", "true");
  formData.append("voice_mode", "true");
  if (utteranceBytes) {
    formData.append(
      "files",
      asBlob(utteranceBytes, "audio/wav"),
      utteranceFileName
    );
  }
  if (threadId) {
    formData.append("thread_id", threadId);
  }
  if (userTimezone) {
    formData.append("user_timezone", userTimezone);
  }
  appendLiveMinecraftShares(formData);
  return formData;
}

export function buildAmbientLookFormData({
  screenshotBytes,
  screenshotFileName = "screen.jpg",
  threadId,
  userTimezone,
  capturedAt,
  playPromptMessage = "",
  includeLiveShares = false,
} = {}) {
  const formData = new FormData();
  formData.append("message", playPromptMessage ?? "");
  formData.append("stream", "true");
  formData.append("ambient", "true");
  formData.append("voice_mode", "true");
  formData.append("camera_facing", "world");
  formData.append("captured_at", capturedAt ?? new Date().toISOString());
  formData.append("sources", JSON.stringify(["webcam", "screen"]));
  if (screenshotBytes) {
    formData.append(
      "files",
      asBlob(screenshotBytes, "image/jpeg"),
      "webcam.jpg"
    );
    formData.append(
      "files",
      asBlob(screenshotBytes, "image/jpeg"),
      screenshotFileName
    );
  }
  if (threadId) {
    formData.append("thread_id", threadId);
  }
  if (userTimezone) {
    formData.append("user_timezone", userTimezone);
  }
  if (includeLiveShares) {
    appendLiveMinecraftShares(formData);
  }
  return formData;
}

export function buildTypedChatFormData({
  playPromptMessage = "",
  threadId,
  userTimezone,
} = {}) {
  return buildIdlePlayFormData({
    playPromptMessage,
    threadId,
    userTimezone,
  });
}

export function buildIdlePlayFormData({
  playPromptMessage = "",
  threadId,
  userTimezone,
} = {}) {
  const formData = new FormData();
  formData.append("message", playPromptMessage ?? "");
  formData.append("stream", "true");
  formData.append("voice_mode", "true");
  if (threadId) {
    formData.append("thread_id", threadId);
  }
  if (userTimezone) {
    formData.append("user_timezone", userTimezone);
  }
  appendLiveMinecraftShares(formData);
  return formData;
}

export function buildLookNowResumeFormData({
  threadId,
  screenshotBytes,
  requestedSources = [],
  userTimezone,
} = {}) {
  const formData = new FormData();
  formData.append("thread_id", threadId);
  formData.append("decision", "looked");
  appendLiveMinecraftShares(formData);
  const sources = requestedLookSources(requestedSources);
  if (screenshotBytes) {
    for (const source of sources) {
      formData.append(
        "files",
        asBlob(screenshotBytes, "image/jpeg"),
        lookNowFileName(source)
      );
    }
    formData.append("sources", JSON.stringify(sources));
  }
  if (userTimezone) {
    formData.append("user_timezone", userTimezone);
  }
  return formData;
}

export function buildStopFormData({ requestId, threadId } = {}) {
  const formData = new FormData();
  if (requestId) {
    formData.append("request_id", requestId);
  }
  if (threadId) {
    formData.append("thread_id", threadId);
  }
  return formData;
}

export function formDataEntries(formData) {
  const entries = [];
  for (const [name, value] of formData.entries()) {
    if (value instanceof Blob) {
      entries.push({
        name,
        kind: "file",
        fileName: value.name || "",
        type: value.type,
        size: value.size,
      });
    } else {
      entries.push({ name, kind: "text", value: String(value) });
    }
  }
  return entries;
}

export function formDataTextFields(formData) {
  const fields = {};
  for (const entry of formDataEntries(formData)) {
    if (entry.kind === "text") {
      fields[entry.name] = entry.value;
    }
  }
  return fields;
}
