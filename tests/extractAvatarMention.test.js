import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractAvatarMention,
  extractDirectedPlayerText,
} from "../companion/src/bot/extractAvatarMention.js";
import { isPlayCommandHelpRequest } from "../companion/src/bot/formatCapabilityHelp.js";

test("requires an @NeuralNexus mention", () => {
  assert.equal(extractAvatarMention("hey isn't this cool?", "NeuralNexus"), null);
  assert.equal(
    extractAvatarMention("@NeuralNexus hey isn't this cool?", "NeuralNexus"),
    "hey isn't this cool?"
  );
  assert.equal(
    extractAvatarMention("@neuralnexus, follow me", "NeuralNexus"),
    "follow me"
  );
  assert.equal(
    extractAvatarMention("NeuralNexus follow me", "NeuralNexus"),
    "follow me"
  );
});

test("c'mon AvatarName and stay there are directed body phrases", () => {
  assert.equal(
    extractDirectedPlayerText("c'mon NeuralNexus", "NeuralNexus"),
    "c'mon"
  );
  assert.equal(extractDirectedPlayerText("stay there", "NeuralNexus"), "stay there");
});

test("what can you do is directed without an @mention", () => {
  assert.equal(isPlayCommandHelpRequest("help"), true);
  assert.equal(
    extractDirectedPlayerText("what can you do?", "NeuralNexus"),
    "what can you do?"
  );
});
