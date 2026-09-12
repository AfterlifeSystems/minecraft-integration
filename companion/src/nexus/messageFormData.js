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
  return formData;
}

export function buildAmbientLookFormData({
  screenshotBytes,
  screenshotFileName = "screen.jpg",
  threadId,
  userTimezone,
  capturedAt,
} = {}) {
  const formData = new FormData();
  formData.append("message", "");
  formData.append("stream", "true");
  formData.append("ambient", "true");
  formData.append("voice_mode", "true");
  formData.append("camera_facing", "world");
  formData.append("captured_at", capturedAt ?? new Date().toISOString());
  formData.append("sources", JSON.stringify(["screen"]));
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
  return formData;
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
