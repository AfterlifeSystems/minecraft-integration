import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAmbientLookFormData,
  buildIdlePlayFormData,
  buildLookNowResumeFormData,
  buildSpokenTurnFormData,
  buildStopFormData,
  buildTypedChatFormData,
  formDataEntries,
  formDataTextFields,
  requestedLookSources,
} from "../companion/src/nexus/messageFormData.js";

test("spoken turn uses diarize and voice_mode from the serving API", () => {
  const formData = buildSpokenTurnFormData({
    playPromptMessage: "follow me",
    utteranceBytes: Buffer.from("RIFF"),
    threadId: "thread-1",
    userTimezone: "America/New_York",
    minecraftWorldSnapshot: "position: 26.5, 73.0, -120.5",
  });
  const fields = formDataTextFields(formData);
  assert.equal(fields.message, "follow me");
  assert.equal(fields.stream, "true");
  assert.equal(fields.diarize, "true");
  assert.equal(fields.voice_mode, "true");
  assert.equal(fields.thread_id, "thread-1");
  assert.equal(fields.user_timezone, "America/New_York");
  assert.equal(fields.ambient, undefined);
  assert.equal(fields.live_shares, '["screen"]');
  assert.equal(fields.minecraft_body, "true");
  assert.equal(fields.minecraft_world, "position: 26.5, 73.0, -120.5");
  assert.doesNotMatch(fields.message, /LATENT_MINECRAFT_BODY/);
  assert.doesNotMatch(fields.minecraft_world, /LATENT_MINECRAFT_BODY/);
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
  assert.equal(fields.live_shares, undefined);
  assert.equal(fields.captured_at, "2026-09-12T12:00:00.000Z");
  assert.equal(fields.message, "");
  assert.equal(fields.minecraft_body, undefined);
});

test("ambient look sends the first-person JPEG exactly once", () => {
  const formData = buildAmbientLookFormData({
    screenshotBytes: Buffer.from("jpeg"),
    threadId: "thread-1",
  });
  const files = formDataEntries(formData).filter(
    (entry) => entry.kind === "file"
  );
  assert.equal(files.length, 1);
  assert.equal(files[0].name, "files");
  assert.equal(files[0].fileName, "screen.jpg");
});

test("ambient look declares the source of the file actually attached", () => {
  const formData = buildAmbientLookFormData({
    screenshotBytes: Buffer.from("jpeg"),
    screenshotFileName: "webcam.jpg",
  });
  assert.equal(formDataTextFields(formData).sources, '["webcam"]');
  assert.deepEqual(
    formDataEntries(formData)
      .filter((entry) => entry.kind === "file")
      .map((entry) => entry.fileName),
    ["webcam.jpg"]
  );
});

test("typed chat is a streamed voice-mode message without diarize", () => {
  const formData = buildTypedChatFormData({
    playPromptMessage: "follow me",
    threadId: "thread-1",
    minecraftWorldSnapshot: "health: 20 food: 20",
  });
  const fields = formDataTextFields(formData);
  assert.equal(fields.stream, "true");
  assert.equal(fields.voice_mode, "true");
  assert.equal(fields.diarize, undefined);
  assert.equal(fields.live_shares, '["screen"]');
  assert.equal(fields.message, "follow me");
  assert.equal(fields.minecraft_body, "true");
  assert.equal(fields.minecraft_world, "health: 20 food: 20");
});

test("idle play turn is a plain streamed voice-mode message", () => {
  const formData = buildIdlePlayFormData({
    playPromptMessage: "",
    threadId: "thread-1",
    minecraftWorldSnapshot: "nearby players: UncleEvan1337",
  });
  const fields = formDataTextFields(formData);
  assert.equal(fields.message, "");
  assert.equal(fields.stream, "true");
  assert.equal(fields.voice_mode, "true");
  assert.equal(fields.diarize, undefined);
  assert.equal(fields.ambient, undefined);
  assert.equal(fields.live_shares, '["screen"]');
  assert.equal(fields.minecraft_body, "true");
  assert.equal(fields.minecraft_world, "nearby players: UncleEvan1337");
});

test("look_now resume sends the first-person JPEG as the requested shares", () => {
  assert.deepEqual(requestedLookSources(["webcam"]), ["screen"]);
  assert.deepEqual(requestedLookSources([]), ["screen"]);
  const formData = buildLookNowResumeFormData({
    threadId: "thread-1",
    screenshotBytes: Buffer.from("jpeg"),
    requestedSources: ["webcam"],
    minecraftWorldSnapshot: "held: dark_oak_log",
  });
  const fields = formDataTextFields(formData);
  assert.equal(fields.decision, "looked");
  assert.equal(fields.thread_id, "thread-1");
  assert.equal(fields.live_shares, '["screen"]');
  assert.equal(fields.sources, '["screen"]');
  assert.equal(fields.minecraft_body, "true");
  assert.equal(fields.minecraft_world, "held: dark_oak_log");
});

test("stop turn sends request_id", () => {
  const fields = formDataTextFields(
    buildStopFormData({ requestId: "req-1", threadId: "thread-1" })
  );
  assert.equal(fields.request_id, "req-1");
  assert.equal(fields.thread_id, "thread-1");
});

test("every Minecraft turn skips the web-only quality metrics", async () => {
  const messageFormDataModule = await import("../companion/src/nexus/messageFormData.js");
  const resumeFields = messageFormDataModule.formDataTextFields(
    messageFormDataModule.buildLookNowResumeFormData({ threadId: "thread-1" })
  );
  const typedFields = messageFormDataModule.formDataTextFields(
    messageFormDataModule.buildTypedChatFormData({ playPromptMessage: "hi" })
  );
  assert.equal(resumeFields.include_quality_metrics, "false");
  assert.equal(typedFields.include_quality_metrics, "false");
});
