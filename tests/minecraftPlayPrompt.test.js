import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MINECRAFT_PLAY_COMMAND_NAMES,
  buildMinecraftPlayPrompt,
} from "../companion/src/prompt/minecraftPlayPrompt.js";
import { consumeServerSentEventBuffer } from "../companion/src/nexus/parseServerSentEvents.js";
import { collectMessageTurnFromFrames } from "../companion/src/nexus/parseServerSentEvents.js";

test("conversation message leads with the person's words and keeps commands latent", () => {
  const prompt = buildMinecraftPlayPrompt({
    worldSnapshotText: "position: 0, 64, 0",
    kidSpeechText: "where do you work?",
  });
  assert.ok(prompt.startsWith("where do you work?"));
  assert.match(prompt, /<LATENT_MINECRAFT_BODY>/);
  assert.match(prompt, /zero commands/);
  assert.doesNotMatch(prompt, /Mineflayer/);
  assert.doesNotMatch(prompt, /Play the game/);
  for (const name of MINECRAFT_PLAY_COMMAND_NAMES) {
    assert.match(prompt, new RegExp(`!${name}`));
  }
  assert.match(prompt, /position: 0, 64, 0/);
});

test("SSE collector keeps thread_id and done content", () => {
  const { frames } = consumeServerSentEventBuffer(
    [
      'data: {"type":"turn_started","request_id":"r1","thread_id":"t1"}\n\n',
      'data: {"type":"assistant_token","text":"Hi"}\n\n',
      'data: {"type":"done","content":"Hi there","thread_id":"t1","request_id":"r1"}\n\n',
    ].join("")
  );
  const collected = collectMessageTurnFromFrames(frames);
  assert.equal(collected.threadId, "t1");
  assert.equal(collected.requestId, "r1");
  assert.equal(collected.content, "Hi there");
});

test("interrupt frame keeps a look_now pause", () => {
  const { frames } = consumeServerSentEventBuffer(
    'data: {"type":"interrupt","thread_id":"t1","interrupt":{"kind":"look_now","sources":["webcam"]}}\n\n'
  );
  const collected = collectMessageTurnFromFrames(frames);
  assert.equal(collected.threadId, "t1");
  assert.equal(collected.interrupt.kind, "look_now");
  assert.deepEqual(collected.interrupt.sources, ["webcam"]);
});

test("spoken_turn frame keeps the heard script for body intents", () => {
  const { frames } = consumeServerSentEventBuffer(
    'data: {"type":"spoken_turn","content":"follow me"}\n\n'
  );
  const collected = collectMessageTurnFromFrames(frames);
  assert.equal(collected.spokenTurnText, "follow me");
});
