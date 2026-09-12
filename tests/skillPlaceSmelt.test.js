import { test } from "node:test";
import assert from "node:assert/strict";
import { createRecordingBot, runSkill } from "../companion/src/skills/skillLibrary.js";

test("placeBlock records the coordinates ChatGPT sent", async () => {
  const bot = createRecordingBot();
  await runSkill(bot, {
    name: "placeBlock",
    arguments: ["oak_planks", 10, 64, -4],
  });
  assert.deepEqual(bot.calls[0], {
    name: "placeBlock",
    arguments: ["oak_planks", 10, 64, -4],
  });
});

test("smelt records the item to put in the furnace", async () => {
  const bot = createRecordingBot();
  await runSkill(bot, { name: "smelt", arguments: ["iron_ore"] });
  assert.deepEqual(bot.calls[0], { name: "smelt", arguments: ["iron_ore"] });
});
