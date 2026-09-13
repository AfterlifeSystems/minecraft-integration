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
