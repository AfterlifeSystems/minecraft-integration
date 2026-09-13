import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isAbortError,
  isCompanionOwnVoiceEvent,
  isOtherPlayerVoiceEvent,
  pcmMeetsSpeechThreshold,
  rememberTurnStartedFrame,
} from "../companion/src/bot/voiceUtteranceFilter.js";

test("ignores Simple Voice Chat packets from the avatar body", () => {
  assert.equal(
    isCompanionOwnVoiceEvent({ sender: "NeuralNexus" }, "NeuralNexus"),
    true
  );
  assert.equal(
    isCompanionOwnVoiceEvent({ sender: "UncleEvan1337" }, "NeuralNexus"),
    false
  );
});

test("treats fetch abort as a takeover, not a crash", () => {
  assert.equal(isAbortError({ name: "AbortError", message: "This operation was aborted" }), true);
  assert.equal(isAbortError(new Error("Spoken turn failed")), false);
});

test("drops voice packets with no player name or from the avatar", () => {
  assert.equal(isOtherPlayerVoiceEvent({ sender: "" }, "NeuralNexus"), false);
  assert.equal(isOtherPlayerVoiceEvent({ sender: "NeuralNexus" }, "NeuralNexus"), false);
  assert.equal(
    isOtherPlayerVoiceEvent({ sender: "UncleEvan1337" }, "NeuralNexus"),
    true
  );
});

test("accepts Simple Voice Chat levels seen from UncleEvan1337", () => {
  const sampleCount = Math.floor(48000 * 0.68);
  const spoken = Buffer.alloc(sampleCount * 2);
  for (let index = 0; index < sampleCount; index += 1) {
    spoken.writeInt16LE(index % 32 === 0 ? 488 : 70, index * 2);
  }
  const speech = pcmMeetsSpeechThreshold(spoken);
  assert.equal(speech.accepted, true);
});

test("rejects near-silent PCM that never crossed a speech threshold", () => {
  const quiet = Buffer.alloc(48000, 0);
  assert.equal(pcmMeetsSpeechThreshold(quiet).accepted, false);
  const spoken = Buffer.alloc(48000 * 2);
  for (let offset = 0; offset < spoken.length; offset += 2) {
    spoken.writeInt16LE(offset % 4000 > 2000 ? 8000 : -8000, offset);
  }
  assert.equal(pcmMeetsSpeechThreshold(spoken).accepted, true);
});

test("stores request_id as soon as turn_started arrives", () => {
  const configuration = { lastRequestId: null, threadId: null };
  rememberTurnStartedFrame(
    { type: "turn_started", request_id: "req-live", thread_id: "thread-live" },
    configuration
  );
  assert.equal(configuration.lastRequestId, "req-live");
  assert.equal(configuration.threadId, "thread-live");
});
