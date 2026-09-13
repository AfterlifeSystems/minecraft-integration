import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatCapabilityHelpLines,
  isPlayCommandHelpRequest,
} from "../companion/src/bot/formatCapabilityHelp.js";

test("what can you do is a help request", () => {
  assert.equal(isPlayCommandHelpRequest("what can you do?"), true);
  assert.equal(isPlayCommandHelpRequest("What can you do"), true);
  assert.equal(isPlayCommandHelpRequest("help"), true);
  assert.equal(isPlayCommandHelpRequest("where do you work?"), false);
});

test("help lines are natural language and cover the COMMANDS.md catalog", () => {
  const lines = formatCapabilityHelpLines("NeuralNexus");
  assert.ok(lines.length >= 6);
  const joined = lines.join(" ");
  assert.match(joined, /Neural Nexus/);
  assert.match(joined, /follow me/);
  assert.match(joined, /c'mon NeuralNexus/);
  assert.match(joined, /stay there/);
  assert.match(joined, /gather or mine/);
  assert.match(joined, /2 by 2/);
  assert.match(joined, /furnace/);
  assert.match(joined, /one hit/);
  assert.match(joined, /eat/);
  assert.match(joined, /sleep/);
  assert.doesNotMatch(joined, /!follow/);
  for (const line of lines) {
    assert.ok(line.length <= 240, line);
  }
});
