import { test } from "node:test";
import assert from "node:assert/strict";
import {
  companionIsBusyWithUserTurn,
  enqueueUserTurn,
} from "../companion/src/bot/userTurnQueue.js";

test("accepts typed and spoken without dropping the other", () => {
  const queued = enqueueUserTurn(
    enqueueUserTurn([], { kind: "spoken", id: 1 }),
    { kind: "typed", id: 2 }
  );
  assert.deepEqual(
    queued.map((item) => item.kind),
    ["spoken", "typed"]
  );
});

test("drops an older spoken turn before dropping typed chat", () => {
  let queued = [];
  queued = enqueueUserTurn(queued, { kind: "spoken", id: 1 });
  queued = enqueueUserTurn(queued, { kind: "spoken", id: 2 });
  queued = enqueueUserTurn(queued, { kind: "typed", id: 3 });
  queued = enqueueUserTurn(queued, { kind: "spoken", id: 4 });
  assert.deepEqual(
    queued.map((item) => item.id),
    [2, 3, 4]
  );
});

test("marks the companion busy while a turn is queued or draining", () => {
  assert.equal(
    companionIsBusyWithUserTurn({
      drainingTurns: false,
      queuedCount: 1,
      activeUserTurnKind: null,
    }),
    true
  );
  assert.equal(
    companionIsBusyWithUserTurn({
      drainingTurns: false,
      queuedCount: 0,
      activeUserTurnKind: null,
    }),
    false
  );
  assert.equal(
    companionIsBusyWithUserTurn({
      drainingTurns: false,
      queuedCount: 0,
      activeUserTurnKind: null,
      ambientLookInFlight: true,
    }),
    true
  );
});
