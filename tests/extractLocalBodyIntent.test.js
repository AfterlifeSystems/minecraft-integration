import { test } from "node:test";
import assert from "node:assert/strict";
import { extractLocalBodyIntent } from "../companion/src/bot/extractLocalBodyIntent.js";

test("maps follow and stop phrases without asking Neural Nexus for !commands", () => {
  assert.deepEqual(extractLocalBodyIntent("follow me"), [
    { name: "follow", arguments: [] },
  ]);
  assert.deepEqual(extractLocalBodyIntent("please follow me"), [
    { name: "follow", arguments: [] },
  ]);
  assert.deepEqual(extractLocalBodyIntent("follow"), [
    { name: "follow", arguments: [] },
  ]);
  assert.deepEqual(extractLocalBodyIntent("stop following"), [
    { name: "stop", arguments: [] },
  ]);
  assert.deepEqual(extractLocalBodyIntent("look at me"), [
    { name: "lookAt", arguments: ["player"] },
  ]);
  assert.deepEqual(extractLocalBodyIntent("c'mon NeuralNexus"), [
    { name: "follow", arguments: [] },
  ]);
  assert.deepEqual(extractLocalBodyIntent("come on"), [
    { name: "follow", arguments: [] },
  ]);
  assert.deepEqual(extractLocalBodyIntent("stay there"), [
    { name: "stop", arguments: [] },
  ]);
  assert.deepEqual(extractLocalBodyIntent("stay put"), [
    { name: "stop", arguments: [] },
  ]);
});

test("leaves identity questions without a body job", () => {
  assert.deepEqual(extractLocalBodyIntent("where do you work?"), []);
  assert.deepEqual(extractLocalBodyIntent("describe yourself please"), []);
});

test("gather, dig, and wait commands run on the body without a look", () => {
  const gatherWood = [{ name: "collectBlocks", arguments: ["log", 8] }];
  assert.deepEqual(extractLocalBodyIntent("gather wood"), gatherWood);
  assert.deepEqual(extractLocalBodyIntent("GatherWoods"), gatherWood);
  assert.deepEqual(extractLocalBodyIntent("gather"), gatherWood);
  assert.deepEqual(extractLocalBodyIntent("can you chop some trees"), gatherWood);
  assert.deepEqual(extractLocalBodyIntent("get wood"), gatherWood);
  assert.deepEqual(extractLocalBodyIntent("dig"), [
    { name: "collectBlocks", arguments: ["dirt", 4] },
  ]);
  assert.deepEqual(extractLocalBodyIntent("mine stone"), [
    { name: "collectBlocks", arguments: ["stone", 4] },
  ]);
  assert.deepEqual(extractLocalBodyIntent("wait here"), [
    { name: "stop", arguments: [] },
  ]);
  assert.deepEqual(extractLocalBodyIntent("stop followin"), [
    { name: "stop", arguments: [] },
  ]);
  assert.deepEqual(extractLocalBodyIntent("stay with me"), [
    { name: "follow", arguments: [] },
  ]);
});

test("questions and unknown jobs are left to Neural Nexus", () => {
  assert.deepEqual(extractLocalBodyIntent("did you get wood yesterday?"), []);
  assert.deepEqual(extractLocalBodyIntent("get"), []);
  assert.deepEqual(extractLocalBodyIntent("dig a tunnel"), []);
  assert.deepEqual(extractLocalBodyIntent("what do you see?"), []);
  assert.deepEqual(extractLocalBodyIntent("give me a joke"), []);
});

test("give me what you collected walks over and hands the inventory over", () => {
  const giveCollected = [{ name: "giveCollected", arguments: ["player"] }];
  assert.deepEqual(extractLocalBodyIntent("give me what you collected"), giveCollected);
  assert.deepEqual(extractLocalBodyIntent("please give me what you gathered"), giveCollected);
  assert.deepEqual(extractLocalBodyIntent("hand over what you collected"), giveCollected);
  assert.deepEqual(extractLocalBodyIntent("toss me everything"), giveCollected);
  assert.deepEqual(extractLocalBodyIntent("give me your stuff"), giveCollected);
  assert.deepEqual(extractLocalBodyIntent("pass me all you collected"), giveCollected);
});
