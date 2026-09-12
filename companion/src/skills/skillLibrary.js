import pathfinderPackage from "mineflayer-pathfinder";
import { Vec3 } from "vec3";
import { firstOtherPlayer } from "../world/worldSnapshot.js";

const { goals } = pathfinderPackage;

const SMELT_FUEL_NAMES = ["coal", "charcoal", "coal_block", "oak_planks", "stick"];
const FURNACE_BLOCK_NAMES = ["furnace", "blast_furnace", "smoker"];

async function recordIfFake(bot, name, argumentValues) {
  if (typeof bot.recordSkill === "function") {
    bot.recordSkill(name, argumentValues);
    return true;
  }
  return false;
}

function otherPlayerOrNamed(bot, playerName) {
  if (playerName && playerName !== "player") {
    const named = Object.values(bot.entities || {}).find(
      (entity) => entity.username === playerName
    );
    if (named) {
      return named;
    }
  }
  return firstOtherPlayer(bot);
}

async function goToPosition(bot, x, y, z, range = 1) {
  if (await recordIfFake(bot, "goto", [x, y, z])) {
    return;
  }
  await bot.pathfinder.goto(new goals.GoalNear(x, y, z, range));
}

export const skillRunners = {
  async goToPlayer(bot, playerName, range = 2) {
    if (await recordIfFake(bot, "goToPlayer", [playerName, range])) {
      return;
    }
    const player = otherPlayerOrNamed(bot, playerName);
    if (!player) {
      throw new Error("No other player is nearby.");
    }
    await bot.pathfinder.goto(
      new goals.GoalFollow(player, Number(range) || 2)
    );
  },

  async goto(bot, x, y, z) {
    await goToPosition(bot, Number(x), Number(y), Number(z));
  },

  async follow(bot, playerName) {
    if (await recordIfFake(bot, "follow", [playerName])) {
      return;
    }
    const player = otherPlayerOrNamed(bot, playerName);
    if (!player) {
      throw new Error("No other player is nearby to follow.");
    }
    bot.pathfinder.setGoal(new goals.GoalFollow(player, 2), true);
  },

  async stop(bot) {
    if (await recordIfFake(bot, "stop", [])) {
      return;
    }
    bot.pathfinder.setGoal(null);
    bot.clearControlStates();
  },

  async lookAt(bot, targetName) {
    if (await recordIfFake(bot, "lookAt", [targetName])) {
      return;
    }
    const player = otherPlayerOrNamed(bot, targetName);
    if (player) {
      await bot.lookAt(player.position.offset(0, 1.6, 0));
      return;
    }
    throw new Error("Nothing to look at.");
  },

  async collectBlocks(bot, blockName, count = 1) {
    const wanted = Math.max(1, Number(count) || 1);
    if (await recordIfFake(bot, "collectBlocks", [blockName, wanted])) {
      return;
    }
    const blockId = bot.registry.blocksByName[blockName]?.id;
    if (blockId === undefined) {
      throw new Error(`Unknown block ${blockName}.`);
    }
    for (let collected = 0; collected < wanted; collected += 1) {
      const block = bot.findBlock({
        matching: blockId,
        maxDistance: 64,
      });
      if (!block) {
        break;
      }
      await bot.pathfinder.goto(
        new goals.GoalNear(block.position.x, block.position.y, block.position.z, 1)
      );
      await bot.dig(block);
    }
  },

  async mineBlock(bot, blockName) {
    return skillRunners.collectBlocks(bot, blockName, 1);
  },

  async placeBlock(bot, blockName, x, y, z) {
    if (await recordIfFake(bot, "placeBlock", [blockName, x, y, z])) {
      return;
    }
    const item = bot.inventory.items().find((entry) => entry.name === blockName);
    if (!item) {
      throw new Error(`${blockName} is not in inventory.`);
    }
    const target = new Vec3(
      Math.floor(Number(x)),
      Math.floor(Number(y)),
      Math.floor(Number(z))
    );
    await bot.pathfinder.goto(new goals.GoalNear(target.x, target.y, target.z, 3));
    await bot.equip(item, "hand");
    const faces = [
      { offset: new Vec3(0, -1, 0), face: new Vec3(0, 1, 0) },
      { offset: new Vec3(0, 1, 0), face: new Vec3(0, -1, 0) },
      { offset: new Vec3(-1, 0, 0), face: new Vec3(1, 0, 0) },
      { offset: new Vec3(1, 0, 0), face: new Vec3(-1, 0, 0) },
      { offset: new Vec3(0, 0, -1), face: new Vec3(0, 0, 1) },
      { offset: new Vec3(0, 0, 1), face: new Vec3(0, 0, -1) },
    ];
    for (const { offset, face } of faces) {
      const reference = bot.blockAt(target.plus(offset));
      if (reference && reference.name !== "air" && reference.name !== "cave_air") {
        await bot.placeBlock(reference, face);
        return;
      }
    }
    throw new Error(
      `No solid face next to ${target.x},${target.y},${target.z} to place ${blockName}.`
    );
  },

  async craftRecipe(bot, itemName, count = 1) {
    if (await recordIfFake(bot, "craftRecipe", [itemName, count])) {
      return;
    }
    const recipes = bot.recipesFor(
      bot.registry.itemsByName[itemName]?.id,
      null,
      1,
      null
    );
    if (!recipes.length) {
      throw new Error(`No recipe for ${itemName}.`);
    }
    await bot.craft(recipes[0], Number(count) || 1, null);
  },

  async smelt(bot, itemName) {
    if (await recordIfFake(bot, "smelt", [itemName])) {
      return;
    }
    const furnaceIds = FURNACE_BLOCK_NAMES.map(
      (name) => bot.registry.blocksByName[name]?.id
    ).filter((id) => id !== undefined);
    const furnaceBlock = bot.findBlock({
      matching: furnaceIds,
      maxDistance: 32,
    });
    if (!furnaceBlock) {
      throw new Error("No furnace, blast furnace, or smoker is nearby.");
    }
    await bot.pathfinder.goto(
      new goals.GoalNear(
        furnaceBlock.position.x,
        furnaceBlock.position.y,
        furnaceBlock.position.z,
        2
      )
    );
    const furnace = await bot.openFurnace(furnaceBlock);
    try {
      const input = bot.inventory
        .items()
        .find(
          (entry) =>
            entry.name === itemName ||
            entry.name === `${itemName}_ore` ||
            entry.name.endsWith(`_${itemName}`)
        );
      if (!input) {
        throw new Error(`${itemName} is not in inventory to smelt.`);
      }
      const fuel = bot.inventory
        .items()
        .find((entry) => SMELT_FUEL_NAMES.includes(entry.name));
      if (!fuel) {
        throw new Error("No coal, charcoal, or planks in inventory for fuel.");
      }
      await furnace.putInput(input.type, null, 1);
      await furnace.putFuel(fuel.type, null, 1);
      const started = Date.now();
      while (Date.now() - started < 30000) {
        if (furnace.outputItem()) {
          await furnace.takeOutput();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw new Error(`Smelting ${itemName} did not finish in 30 seconds.`);
    } finally {
      furnace.close();
    }
  },

  async equip(bot, itemName) {
    if (await recordIfFake(bot, "equip", [itemName])) {
      return;
    }
    const item = bot.inventory.items().find((entry) => entry.name === itemName);
    if (!item) {
      throw new Error(`${itemName} is not in inventory.`);
    }
    await bot.equip(item, "hand");
  },

  async toss(bot, itemName, count = 1) {
    if (await recordIfFake(bot, "toss", [itemName, count])) {
      return;
    }
    const item = bot.inventory.items().find((entry) => entry.name === itemName);
    if (!item) {
      throw new Error(`${itemName} is not in inventory.`);
    }
    await bot.toss(item.type, null, Number(count) || 1);
  },

  async useOn(bot, targetName) {
    if (await recordIfFake(bot, "useOn", [targetName])) {
      return;
    }
    const player = otherPlayerOrNamed(bot, targetName);
    if (player) {
      await bot.lookAt(player.position);
    }
    bot.activateItem();
  },

  async attack(bot, targetName) {
    if (await recordIfFake(bot, "attack", [targetName])) {
      return;
    }
    const target = Object.values(bot.entities || {}).find(
      (entity) =>
        entity.username === targetName ||
        entity.name === targetName ||
        entity.displayName === targetName
    );
    if (!target) {
      throw new Error(`No entity named ${targetName}.`);
    }
    await bot.attack(target);
  },

  async sleep(bot) {
    if (await recordIfFake(bot, "sleep", [])) {
      return;
    }
    const bed = bot.findBlock({
      matching: (block) => block && String(block.name).includes("bed"),
      maxDistance: 8,
    });
    if (!bed) {
      throw new Error("No bed nearby.");
    }
    await bot.sleep(bed);
  },

  async eat(bot) {
    if (await recordIfFake(bot, "eat", [])) {
      return;
    }
    const food = bot.inventory.items().find((item) => item.foodRestore);
    if (!food) {
      throw new Error("No food in inventory.");
    }
    await bot.equip(food, "hand");
    await bot.consume();
  },

  async jump(bot) {
    if (await recordIfFake(bot, "jump", [])) {
      return;
    }
    bot.setControlState("jump", true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    bot.setControlState("jump", false);
  },

  async sneak(bot) {
    if (await recordIfFake(bot, "sneak", [])) {
      return;
    }
    bot.setControlState("sneak", true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    bot.setControlState("sneak", false);
  },

  async say_chat(bot, text) {
    if (await recordIfFake(bot, "say_chat", [text])) {
      return;
    }
    bot.chat(String(text));
  },
};

export async function runSkill(bot, command) {
  const runner = skillRunners[command.name];
  if (!runner) {
    throw new Error(`Unknown skill ${command.name}.`);
  }
  await runner(bot, ...(command.arguments || []));
}

export function createRecordingBot() {
  const calls = [];
  return {
    calls,
    recordSkill(name, argumentValues) {
      calls.push({ name, arguments: argumentValues });
    },
  };
}
