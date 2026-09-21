import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MINECRAFT_PLAY_COMMAND_NAMES,
  buildMinecraftPlayPrompt,
} from "../companion/src/prompt/minecraftPlayPrompt.js";
import { consumeServerSentEventBuffer } from "../companion/src/nexus/parseServerSentEvents.js";
import { collectMessageTurnFromFrames } from "../companion/src/nexus/parseServerSentEvents.js";

test("conversation message is the person's words as-is and never a play prompt", () => {
  const prompt = buildMinecraftPlayPrompt({
    worldSnapshotText: "position: 0, 64, 0",
    kidSpeechText: "where do you work?",
  });
  assert.equal(prompt, "where do you work?");
  assert.doesNotMatch(prompt, /LATENT_MINECRAFT_BODY/);
  assert.doesNotMatch(prompt, /MINECRAFT_WORLD/);
  assert.doesNotMatch(prompt, /Mineflayer/);
  for (const name of MINECRAFT_PLAY_COMMAND_NAMES) {
    assert.doesNotMatch(prompt, new RegExp(`!${name}`));
  }
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

test("SSE collector keeps minecraft_act commands and as-is text", () => {
  const { frames } = consumeServerSentEventBuffer(
    [
      'data: {"type":"minecraft_act","commands":[{"name":"follow","arguments":[]}],"additional_as_is_text":"stay close"}\n\n',
      'data: {"type":"done","content":"On my way.","thread_id":"t1"}\n\n',
    ].join("")
  );
  const collected = collectMessageTurnFromFrames(frames);
  assert.equal(collected.content, "On my way.");
  assert.deepEqual(collected.minecraftAct, {
    commands: [{ name: "follow", arguments: [] }],
    additional_as_is_text: "stay close",
  });
});
