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

// The first-person Minecraft view rides the screen source and nothing else.
// Reporting a "webcam" told the avatar a camera pointed at the player was
// live, so "look at me" became a look through a camera that does not exist
// ("I don't see you in the webcam view"). Anubis offers look_now to a
// Minecraft body only for sight questions, and only for the screen source.
export const LIVE_MINECRAFT_SHARES = '["screen"]';

function appendLiveMinecraftShares(formData) {
  formData.append("live_shares", LIVE_MINECRAFT_SHARES);
}

function appendMinecraftBody(formData, minecraftWorldSnapshot) {
  formData.append("minecraft_body", "true");
  formData.append("minecraft_world", minecraftWorldSnapshot ?? "");
}

export function lookNowFileName(sourceName) {
  return sourceName === "webcam" ? "webcam.jpg" : "screen.jpg";
}

// Inverse of lookNowFileName, so the declared sources field and the attached
// file always name the same single source.
export function lookSourceForFileName(fileName) {
  return fileName === "webcam.jpg" ? "webcam" : "screen";
}

// The body has one view, the first-person screen. A request naming the webcam
// is still answered with that one view, labelled as the screen source.
export function requestedLookSources(_interruptSources) {
  return ["screen"];
}

export function buildSpokenTurnFormData({
  playPromptMessage = "",
  utteranceBytes,
  utteranceFileName = "utterance.wav",
  threadId,
  userTimezone,
  minecraftWorldSnapshot = "",
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
  appendMinecraftBody(formData, minecraftWorldSnapshot);
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
  formData.append(
    "sources",
    JSON.stringify([lookSourceForFileName(screenshotFileName)])
  );
  // One first-person JPEG per ambient look. Attaching the same JPEG a second
  // time under another file name charged image tokens twice per ambient look.
  if (screenshotBytes) {
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
  minecraftWorldSnapshot = "",
} = {}) {
  return buildIdlePlayFormData({
    playPromptMessage,
    threadId,
    userTimezone,
    minecraftWorldSnapshot,
  });
}

export function buildIdlePlayFormData({
  playPromptMessage = "",
  threadId,
  userTimezone,
  minecraftWorldSnapshot = "",
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
  appendMinecraftBody(formData, minecraftWorldSnapshot);
  return formData;
}

export function buildLookNowResumeFormData({
  threadId,
  screenshotBytes,
  requestedSources = [],
  userTimezone,
  minecraftWorldSnapshot = "",
} = {}) {
  const formData = new FormData();
  formData.append("thread_id", threadId);
  formData.append("decision", "looked");
  appendLiveMinecraftShares(formData);
  appendMinecraftBody(formData, minecraftWorldSnapshot);
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
