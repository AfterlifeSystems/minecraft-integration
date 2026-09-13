import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAmbientLookFormData,
  buildIdlePlayFormData,
  buildLookNowResumeFormData,
  buildSpokenTurnFormData,
  buildStopFormData,
  buildTypedChatFormData,
  formDataTextFields,
  requestedLookSources,
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
  assert.equal(fields.live_shares, '["webcam","screen"]');
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
  assert.equal(fields.sources, '["webcam","screen"]');
  assert.equal(fields.live_shares, undefined);
  assert.equal(fields.captured_at, "2026-09-12T12:00:00.000Z");
  assert.equal(fields.message, "");
});

test("typed chat is a streamed voice-mode message without diarize", () => {
  const formData = buildTypedChatFormData({
    playPromptMessage: "The player just said:\nfollow me",
    threadId: "thread-1",
  });
  const fields = formDataTextFields(formData);
  assert.equal(fields.stream, "true");
  assert.equal(fields.voice_mode, "true");
  assert.equal(fields.diarize, undefined);
  assert.equal(fields.live_shares, '["webcam","screen"]');
  assert.match(fields.message, /follow me/);
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
  assert.equal(fields.live_shares, '["webcam","screen"]');
});

test("look_now resume sends the first-person JPEG as the requested shares", () => {
  assert.deepEqual(requestedLookSources(["webcam"]), ["webcam"]);
  assert.deepEqual(requestedLookSources([]), ["webcam", "screen"]);
  const formData = buildLookNowResumeFormData({
    threadId: "thread-1",
    screenshotBytes: Buffer.from("jpeg"),
    requestedSources: ["webcam"],
  });
  const fields = formDataTextFields(formData);
  assert.equal(fields.decision, "looked");
  assert.equal(fields.thread_id, "thread-1");
  assert.equal(fields.live_shares, '["webcam","screen"]');
  assert.equal(fields.sources, '["webcam"]');
});

test("stop turn sends request_id", () => {
  const fields = formDataTextFields(
    buildStopFormData({ requestId: "req-1", threadId: "thread-1" })
  );
  assert.equal(fields.request_id, "req-1");
  assert.equal(fields.thread_id, "thread-1");
});
