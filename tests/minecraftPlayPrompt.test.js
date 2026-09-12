import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MINECRAFT_PLAY_COMMAND_NAMES,
  buildMinecraftPlayPrompt,
} from "../companion/src/prompt/minecraftPlayPrompt.js";
import { consumeServerSentEventBuffer } from "../companion/src/nexus/parseServerSentEvents.js";
import { collectMessageTurnFromFrames } from "../companion/src/nexus/parseServerSentEvents.js";

test("play prompt lists every command the body can run", () => {
  const prompt = buildMinecraftPlayPrompt({
    worldSnapshotText: "position: 0, 64, 0",
    kidSpeechText: "get wood",
  });
  for (const name of MINECRAFT_PLAY_COMMAND_NAMES) {
    assert.match(prompt, new RegExp(`!${name}`));
  }
  assert.match(prompt, /position: 0, 64, 0/);
  assert.match(prompt, /get wood/);
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
