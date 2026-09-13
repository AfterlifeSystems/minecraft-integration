import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitSpokenSentences,
  wrapSpokenChatLines,
} from "../companion/src/bot/splitSpokenChat.js";

test("splits a reply into spoken sentences", () => {
  assert.deepEqual(
    splitSpokenSentences("I work on Neuralink. The office is nearby."),
    ["I work on Neuralink.", "The office is nearby."]
  );
  assert.deepEqual(splitSpokenSentences("Just one line"), ["Just one line"]);
});

test("wraps a long sentence to Minecraft chat length", () => {
  const words = Array.from({ length: 80 }, (_, index) => `word${index}`);
  const lines = wrapSpokenChatLines(words.join(" "), 40);
  assert.ok(lines.length > 1);
  for (const line of lines) {
    assert.ok(line.length <= 40, line);
  }
});
