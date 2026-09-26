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

test("placeBlock with no coordinates places beside the body", async () => {
  const { Vec3 } = await import("vec3");
  const { skillRunners, placementSpotBesideBody } = await import(
    "../companion/src/skills/skillLibrary.js"
  );
  const solidBelowFeet = (position) => (position.y < 64 ? { name: "dirt" } : { name: "air" });
  const placed = [];
  const bot = {
    entity: { position: new Vec3(10.5, 64, 20.5), yaw: 0 },
    blockAt: (position) => ({ ...solidBelowFeet(position), position }),
    inventory: { items: () => [{ name: "dirt" }] },
    equip: async () => {},
    pathfinder: { goto: async () => { throw new Error("must not walk"); } },
    placeBlock: async (reference, face) => placed.push({ reference, face }),
  };
  const spot = placementSpotBesideBody(bot);
  assert.deepEqual([spot.x, spot.y, spot.z], [10, 64, 19]);
  await skillRunners.placeBlock(bot, "dirt");
  assert.equal(placed.length, 1);
  assert.deepEqual(
    [placed[0].reference.position.x, placed[0].reference.position.y, placed[0].reference.position.z],
    [10, 63, 19]
  );
});

test("placeBlock crafts a missing block from what the body carries", async () => {
  const { Vec3 } = await import("vec3");
  const { skillRunners } = await import("../companion/src/skills/skillLibrary.js");
  const inventory = [{ name: "birch_log" }];
  const crafted = [];
  const bot = {
    entity: { position: new Vec3(10.5, 64, 20.5), yaw: 0 },
    registry: { itemsByName: { birch_planks: { id: 42 } } },
    recipesFor: (itemId) => (itemId === 42 ? [{ result: "birch_planks" }] : []),
    craft: async (recipe) => {
      crafted.push(recipe.result);
      inventory.push({ name: "birch_planks" });
    },
    blockAt: (position) => ({ name: position.y < 64 ? "dirt" : "air", position }),
    inventory: { items: () => inventory },
    equip: async () => {},
    pathfinder: { goto: async () => {} },
    placeBlock: async () => {},
  };
  await skillRunners.placeBlock(bot, "birch_planks");
  assert.deepEqual(crafted, ["birch_planks"]);
});

test("collectBlocks walks onto the drops the dig left behind", async () => {
  const { Vec3 } = await import("vec3");
  const { skillRunners } = await import("../companion/src/skills/skillLibrary.js");
  const walkedTo = [];
  const entities = {};
  const bot = {
    entity: { position: new Vec3(0, 64, 0) },
    entities,
    registry: { blocksByName: { dirt: { id: 6 } } },
    findBlock: () => ({ position: new Vec3(1, 63, 0) }),
    pathfinder: {
      goto: async (goal) => {
        walkedTo.push([goal.x, goal.y, goal.z]);
      },
    },
    dig: async () => {
      entities[7] = { id: 7, name: "item", position: new Vec3(1, 63, 0) };
    },
  };
  await skillRunners.collectBlocks(bot, "dirt", 1);
  assert.deepEqual(walkedTo.at(-1), [1, 63, 0]);
});

test("giveCollected walks to the player and tosses every carried stack", async () => {
  const { Vec3 } = await import("vec3");
  const { skillRunners } = await import("../companion/src/skills/skillLibrary.js");
  const inventory = [
    { name: "birch_log", type: 10, count: 26 },
    { name: "dirt", type: 9, count: 100 },
  ];
  const tossed = [];
  const lookedAt = [];
  const walkedGoals = [];
  const bot = {
    username: "NeuralNexus",
    inventory: {
      items: () => inventory,
    },
    players: {
      UncleEvan1337: {
        username: "UncleEvan1337",
        entity: { username: "UncleEvan1337", position: new Vec3(5, 64, 5) },
      },
    },
    entities: {},
    pathfinder: {
      goto: async (goal) => {
        walkedGoals.push(goal);
      },
    },
    lookAt: async (position) => {
      lookedAt.push(position);
    },
    toss: async (itemType, metadata, count) => {
      tossed.push({ itemType, count });
      const index = inventory.findIndex((stack) => stack.type === itemType);
      if (index !== -1) {
        inventory.splice(index, 1);
      }
    },
  };
  await skillRunners.giveCollected(bot, "player");
  assert.equal(walkedGoals.length, 1);
  assert.equal(lookedAt.length, 1);
  assert.deepEqual(tossed, [
    { itemType: 10, count: 26 },
    { itemType: 9, count: 100 },
  ]);
  assert.equal(inventory.length, 0);
});

test("giveCollected records on a fake bot", async () => {
  const bot = createRecordingBot();
  await runSkill(bot, { name: "giveCollected", arguments: ["player"] });
  assert.deepEqual(bot.calls[0], {
    name: "giveCollected",
    arguments: ["player"],
  });
});
test("craftRecipe sets down its own crafting table when none is near", async () => {
  const { Vec3 } = await import("vec3");
  const { skillRunners } = await import("../companion/src/skills/skillLibrary.js");
  const itemIds = { wooden_pickaxe: 1, crafting_table: 2, oak_planks: 3, stick: 4 };
  const inventory = [
    { name: "oak_planks", count: 8 },
    { name: "stick", count: 4 },
  ];
  const placedBlocks = new Map();
  const crafted = [];
  const bot = {
    entity: { position: new Vec3(10.5, 64, 20.5), yaw: 0 },
    registry: { itemsByName: Object.fromEntries(Object.entries(itemIds).map(([name, id]) => [name, { id }])) },
    inventory: { items: () => inventory },
    findBlock: () => null,
    blockAt: (position) =>
      placedBlocks.get(`${position.x},${position.y},${position.z}`) ||
      { name: position.y < 64 ? "dirt" : "air", position },
    recipesFor: (itemId, _metadata, _count, table) => {
      if (itemId === itemIds.crafting_table) return [{ result: "crafting_table" }];
      if (itemId === itemIds.wooden_pickaxe && table) return [{ result: "wooden_pickaxe" }];
      return [];
    },
    craft: async (recipe) => {
      crafted.push(recipe.result);
      inventory.push({ name: recipe.result, count: 1 });
    },
    equip: async () => {},
    placeBlock: async (reference) => {
      const spot = reference.position.offset(0, 1, 0);
      placedBlocks.set(`${spot.x},${spot.y},${spot.z}`, { name: "crafting_table", position: spot });
    },
    pathfinder: { goto: async () => {} },
  };
  const output = await skillRunners.craftRecipe(bot, "wooden_pickaxe", 1);
  assert.deepEqual(crafted, ["crafting_table", "wooden_pickaxe"]);
  assert.equal(output, "Crafted wooden_pickaxe.");
});
