import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePlayCommands } from "../companion/src/actions/parsePlayCommands.js";

test("strips Mindcraft command lines from spoken text", () => {
  const parsed = parsePlayCommands(
    "On my way.\n!goToPlayer('Steve')\n!collectBlocks('oak_log', 8)"
  );
  assert.equal(parsed.spokenText, "On my way.");
  assert.deepEqual(parsed.commands, [
    { name: "goToPlayer", arguments: ["Steve"] },
    { name: "collectBlocks", arguments: ["oak_log", 8] },
  ]);
});

test("reads a minecraft-actions fence", () => {
  const parsed = parsePlayCommands(
    'Sure.\n```minecraft-actions\n{"actions":[{"name":"follow","target":"player"}]}\n```'
  );
  assert.equal(parsed.spokenText, "Sure.");
  assert.equal(parsed.commands[0].name, "follow");
  assert.equal(parsed.commands[0].arguments[0], "player");
});

test("drops invented command names", () => {
  const parsed = parsePlayCommands("Hi\n!explodeTheWorld(1)");
  assert.equal(parsed.spokenText, "Hi");
  assert.deepEqual(parsed.commands, []);
});
