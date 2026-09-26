import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autonomyMayMoveBody,
  commandsNotAlreadyRun,
  createBodyGoalState,
  mergeMinecraftActs,
  recordBodyCommands,
  trackBodyJob,
} from "../companion/src/bot/bodyGoalState.js";

test("a stop holds the body against autonomy until the player calls the body", () => {
  const bodyGoalState = createBodyGoalState();
  assert.equal(autonomyMayMoveBody(bodyGoalState), true);
  recordBodyCommands(bodyGoalState, [{ name: "stop", arguments: [] }]);
  assert.equal(autonomyMayMoveBody(bodyGoalState), false);
  recordBodyCommands(bodyGoalState, [{ name: "lookAt", arguments: ["player"] }]);
  assert.equal(autonomyMayMoveBody(bodyGoalState), false);
  recordBodyCommands(bodyGoalState, [{ name: "follow", arguments: [] }]);
  assert.equal(autonomyMayMoveBody(bodyGoalState), true);
  assert.equal(bodyGoalState.goalName, "follow");
});

test("a running job keeps autonomy from replacing the job", async () => {
  const bodyGoalState = createBodyGoalState();
  let releaseJob;
  const job = trackBodyJob(
    bodyGoalState,
    () => new Promise((resolve) => (releaseJob = resolve))
  );
  assert.equal(autonomyMayMoveBody(bodyGoalState), false);
  releaseJob([]);
  await job;
  assert.equal(autonomyMayMoveBody(bodyGoalState), true);
});

test("minecraft_act commands from every look leg are kept", () => {
  const merged = mergeMinecraftActs(
    { commands: [{ name: "stop", arguments: [] }], additional_as_is_text: "" },
    { commands: [{ name: "collectBlocks", arguments: ["log", 8] }] }
  );
  assert.deepEqual(
    merged.commands.map((command) => command.name),
    ["stop", "collectBlocks"]
  );
  assert.equal(mergeMinecraftActs(null, null), null);
});

test("the avatar's copy of a command already run locally is skipped", () => {
  assert.deepEqual(
    commandsNotAlreadyRun(
      [
        { name: "collectBlocks", arguments: ["dark_oak_log", 8] },
        { name: "say_chat", arguments: ["on it"] },
      ],
      [{ name: "collectBlocks", arguments: ["log", 8] }]
    ),
    [{ name: "say_chat", arguments: ["on it"] }]
  );
});

test("giveCollected covers the avatar's goToPlayer and toss for the same turn", () => {
  assert.deepEqual(
    commandsNotAlreadyRun(
      [
        { name: "goToPlayer", arguments: ["UncleEvan1337"] },
        { name: "toss", arguments: ["birch_log", 26] },
        { name: "say_chat", arguments: ["here you go"] },
      ],
      [{ name: "giveCollected", arguments: ["player"] }]
    ),
    [{ name: "say_chat", arguments: ["here you go"] }]
  );
});

test("giveCollected releases a hold so the body can walk over", () => {
  const bodyGoalState = createBodyGoalState();
  recordBodyCommands(bodyGoalState, [{ name: "stop", arguments: [] }]);
  assert.equal(autonomyMayMoveBody(bodyGoalState), false);
  recordBodyCommands(bodyGoalState, [{ name: "giveCollected", arguments: ["player"] }]);
  assert.equal(autonomyMayMoveBody(bodyGoalState), true);
  assert.equal(bodyGoalState.goalName, "giveCollected");
});
