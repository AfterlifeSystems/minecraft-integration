import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRecordingBot,
  runSkill,
} from "../companion/src/skills/skillLibrary.js";
import { executePlayCommands } from "../companion/src/actions/executePlayCommands.js";

test("each play skill is invoked on a recording bot", async () => {
  const bot = createRecordingBot();
  await runSkill(bot, { name: "collectBlocks", arguments: ["oak_log", 8] });
  await runSkill(bot, { name: "follow", arguments: [] });
  await runSkill(bot, { name: "goto", arguments: [1, 64, 2] });
  assert.deepEqual(bot.calls, [
    { name: "collectBlocks", arguments: ["oak_log", 8] },
    { name: "follow", arguments: [undefined] },
    { name: "goto", arguments: [1, 64, 2] },
  ]);
});

test("executePlayCommands records failures and continues", async () => {
  const bot = createRecordingBot();
  const results = await executePlayCommands(bot, [
    { name: "jump", arguments: [] },
    { name: "notASkill", arguments: [] },
    { name: "stop", arguments: [] },
  ]);
  assert.equal(results[0].status, "ok");
  assert.equal(results[1].status, "failed");
  assert.equal(results[2].status, "ok");
  assert.equal(bot.calls.length, 2);
});

test("abort stops later skills", async () => {
  const bot = createRecordingBot();
  const abortSignal = { aborted: true };
  const results = await executePlayCommands(
    bot,
    [{ name: "jump", arguments: [] }],
    { abortSignal }
  );
  assert.equal(results[0].status, "aborted");
  assert.equal(bot.calls.length, 0);
});
