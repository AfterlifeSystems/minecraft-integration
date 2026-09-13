import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTypedChatMessage } from "../companion/src/bot/normalizeTypedChatMessage.js";

test("strips the Minecraft sender prefix from messagestr", () => {
  const parsed = normalizeTypedChatMessage(
    "<UncleEvan1337> this is a test sentence"
  );
  assert.equal(parsed.usernameHint, "UncleEvan1337");
  assert.equal(parsed.typedText, "this is a test sentence");
});

test("leaves a plain sentence unchanged", () => {
  const parsed = normalizeTypedChatMessage("follow me");
  assert.equal(parsed.usernameHint, "");
  assert.equal(parsed.typedText, "follow me");
});
