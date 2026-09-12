import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAmbientLookFormData,
  buildIdlePlayFormData,
  buildSpokenTurnFormData,
  buildStopFormData,
  formDataTextFields,
} from "../companion/src/nexus/messageFormData.js";

test("spoken turn uses diarize and voice_mode from the serving API", () => {
  const formData = buildSpokenTurnFormData({
    playPromptMessage: "play this world",
    utteranceBytes: Buffer.from("RIFF"),
    threadId: "thread-1",
    userTimezone: "America/New_York",
  });
  const fields = formDataTextFields(formData);
  assert.equal(fields.message, "play this world");
  assert.equal(fields.stream, "true");
  assert.equal(fields.diarize, "true");
  assert.equal(fields.voice_mode, "true");
  assert.equal(fields.thread_id, "thread-1");
  assert.equal(fields.user_timezone, "America/New_York");
  assert.equal(fields.ambient, undefined);
});

test("ambient look uses screen source and world-facing camera", () => {
  const formData = buildAmbientLookFormData({
    screenshotBytes: Buffer.from("jpeg"),
    threadId: "thread-1",
    capturedAt: "2026-09-12T12:00:00.000Z",
  });
  const fields = formDataTextFields(formData);
  assert.equal(fields.ambient, "true");
  assert.equal(fields.voice_mode, "true");
  assert.equal(fields.camera_facing, "world");
  assert.equal(fields.sources, '["screen"]');
  assert.equal(fields.captured_at, "2026-09-12T12:00:00.000Z");
  assert.equal(fields.message, "");
});

test("idle play turn is a plain streamed voice-mode message", () => {
  const formData = buildIdlePlayFormData({
    playPromptMessage: "continue",
    threadId: "thread-1",
  });
  const fields = formDataTextFields(formData);
  assert.equal(fields.message, "continue");
  assert.equal(fields.stream, "true");
  assert.equal(fields.voice_mode, "true");
  assert.equal(fields.diarize, undefined);
  assert.equal(fields.ambient, undefined);
});

test("stop turn sends request_id", () => {
  const fields = formDataTextFields(
    buildStopFormData({ requestId: "req-1", threadId: "thread-1" })
  );
  assert.equal(fields.request_id, "req-1");
  assert.equal(fields.thread_id, "thread-1");
});
