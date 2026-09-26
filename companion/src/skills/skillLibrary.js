import pathfinderPackage from "mineflayer-pathfinder";
import { Vec3 } from "vec3";
import { firstOtherPlayer } from "../world/worldSnapshot.js";
import { blockIdSearchOrder, placementSpotBesideBody } from "./blockSearch.js";
import { mindcraftQueryRunners, mindcraftSkillRunners } from "./mindcraftSkills.js";

export { blockIdSearchOrder, placementSpotBesideBody };

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
    const namedEntity = Object.values(bot.entities || {}).find(
      (entity) => entity.username === playerName
    );
    if (namedEntity) {
      return namedEntity;
    }
    const namedPlayer = bot.players?.[playerName]?.entity;
    if (namedPlayer) {
      return namedPlayer;
    }
  }
  const nearbyFromTab = Object.values(bot.players || {})
    .map((player) => player?.entity)
    .find((entity) => entity && entity.username !== bot.username);
  if (nearbyFromTab) {
    return nearbyFromTab;
  }
  return firstOtherPlayer(bot);
}

// Dropped items lie where the block broke, and a log broken overhead lands
// at the foot of the tree. Walking onto each nearby drop is what puts the
// block in the inventory; without the walk, "gather wood" left the wood on the
// ground and the next placeBlock found nothing to place.
const DROP_PICKUP_RANGE = 6;
const DROP_PICKUP_TIMEOUT_MS = 4000;

function isDroppedItem(entity) {
  // entity.objectType is deprecated in prismarine-entity and prints a stack
  // trace on every read; name and displayName carry the same answer.
  return entity?.name === "item" || entity?.displayName === "Item";
}

export async function pickUpNearbyDrops(bot, jobGeneration) {
  const origin = bot.entity?.position;
  if (!origin || !bot.pathfinder) {
    return;
  }
  const drops = Object.values(bot.entities || {})
    .filter((entity) => isDroppedItem(entity) && entity.position)
    .filter((entity) => entity.position.distanceTo(origin) <= DROP_PICKUP_RANGE)
    .sort((left, right) => left.position.distanceTo(origin) - right.position.distanceTo(origin));
  for (const drop of drops) {
    if (jobGeneration !== undefined && currentJobGeneration(bot) !== jobGeneration) {
      return;
    }
    if (!bot.entities?.[drop.id]) {
      continue;
    }
    const walk = bot.pathfinder.goto(
      new goals.GoalNear(drop.position.x, drop.position.y, drop.position.z, 0)
    );
    const timeout = new Promise((resolve) => setTimeout(resolve, DROP_PICKUP_TIMEOUT_MS));
    try {
      await Promise.race([walk, timeout]);
    } catch {
      // A drop that despawned or cannot be reached is left behind.
    }
  }
}

// A block the avatar asked to place but does not carry, crafted on the 2 by 2
// grid when the inventory allows (birch_planks from birch_log, for example).
// The model plans several commands at once and skips the crafting step; the
// body fills that step in rather than failing the whole placement.
export async function craftMissingItemInHand(bot, itemName) {
  const itemId = bot.registry?.itemsByName?.[itemName]?.id;
  if (itemId === undefined || typeof bot.recipesFor !== "function") {
    return null;
  }
  const recipes = bot.recipesFor(itemId, null, 1, null) || [];
  if (!recipes.length) {
    return null;
  }
  try {
    await bot.craft(recipes[0], 1, null);
  } catch {
    return null;
  }
  return bot.inventory.items().find((entry) => entry.name === itemName) || null;
}

function inventoryItemNamed(bot, itemName) {
  return (bot.inventory?.items?.() || []).find((entry) => entry.name === itemName) || null;
}

function inventoryCountNamed(bot, itemName) {
  return (bot.inventory?.items?.() || [])
    .filter((entry) => entry.name === itemName)
    .reduce((total, entry) => total + entry.count, 0);
}

async function craftOnce(bot, itemName, times = 1) {
  const itemId = bot.registry?.itemsByName?.[itemName]?.id;
  if (itemId === undefined) {
    return false;
  }
  const recipes = bot.recipesFor(itemId, null, 1, null) || [];
  if (!recipes.length) {
    return false;
  }
  try {
    await bot.craft(recipes[0], times, null);
    return true;
  } catch {
    return false;
  }
}

// Planks from any carried log and sticks from planks: the two ingredients
// every wooden tool and the crafting table itself are made from.
export async function craftBasicIngredients(bot) {
  const log = (bot.inventory?.items?.() || []).find(
    (entry) => entry.name.endsWith("_log") && !entry.name.startsWith("stripped_")
  );
  const plankCount = (bot.inventory?.items?.() || [])
    .filter((entry) => entry.name.endsWith("_planks"))
    .reduce((total, entry) => total + entry.count, 0);
  if (log && plankCount < 8) {
    await craftOnce(bot, log.name.replace(/_log$/, "_planks"), Math.min(log.count, 2));
  }
  if (inventoryCountNamed(bot, "stick") < 2) {
    await craftOnce(bot, "stick", 1);
  }
}

// Carry a crafting table (making one from planks when needed) and set it down
// beside the body. Returns the placed table block, or null.
export async function placeCraftingTableBesideBody(bot) {
  if (!inventoryItemNamed(bot, "crafting_table")) {
    await craftBasicIngredients(bot);
    await craftOnce(bot, "crafting_table", 1);
  }
  const table = inventoryItemNamed(bot, "crafting_table");
  const spot = placementSpotBesideBody(bot);
  if (!table || !spot) {
    return null;
  }
  const ground = bot.blockAt(spot.offset(0, -1, 0));
  if (!ground) {
    return null;
  }
  try {
    await bot.equip(table, "hand");
    await bot.placeBlock(ground, new Vec3(0, 1, 0));
  } catch {
    // The placement confirmation can time out while the block did land; the
    // lookup below is what decides.
  }
  const placed = bot.blockAt(spot);
  return placed?.name === "crafting_table" ? placed : null;
}

// A stop ends every running job: each job loop reads the body's job
// generation and gives up once a later stop has advanced the generation.
function currentJobGeneration(bot) {
  return bot.nexusJobGeneration || 0;
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
    bot.pathfinder.setGoal(
      new goals.GoalFollow(player, Number(range) || 2),
      true
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
    bot.nexusJobGeneration = currentJobGeneration(bot) + 1;
    bot.pathfinder.setGoal(null);
    bot.clearControlStates();
    if (typeof bot.stopDigging === "function") {
      bot.stopDigging();
    }
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
    const searchOrder = blockIdSearchOrder(bot.registry, blockName);
    if (!searchOrder.length) {
      throw new Error(`Unknown block ${blockName}.`);
    }
    const jobGeneration = currentJobGeneration(bot);
    let collected = 0;
    while (collected < wanted) {
      if (currentJobGeneration(bot) !== jobGeneration) {
        return;
      }
      let block = null;
      for (const blockIds of searchOrder) {
        block = bot.findBlock({ matching: blockIds, maxDistance: 64 });
        if (block) {
          break;
        }
      }
      if (!block) {
        break;
      }
      try {
        await bot.pathfinder.goto(
          new goals.GoalNear(block.position.x, block.position.y, block.position.z, 1)
        );
        if (currentJobGeneration(bot) !== jobGeneration) {
          return;
        }
        await bot.dig(block);
        await pickUpNearbyDrops(bot, jobGeneration);
      } catch (error) {
        // A stop interrupts the walk or the dig on purpose ("Digging
        // aborted", "Path was stopped"); the job ended as the player asked,
        // which is not a failure to report.
        if (currentJobGeneration(bot) !== jobGeneration) {
          return;
        }
        throw error;
      }
      collected += 1;
    }
    if (collected === 0) {
      throw new Error(`No ${blockName} within reach.`);
    }
  },

  async mineBlock(bot, blockName) {
    return skillRunners.collectBlocks(bot, blockName, 1);
  },

  async placeBlock(bot, blockName, x, y, z) {
    if (await recordIfFake(bot, "placeBlock", [blockName, x, y, z])) {
      return;
    }
    const item =
      bot.inventory.items().find((entry) => entry.name === blockName) ||
      (await craftMissingItemInHand(bot, blockName));
    if (!item) {
      throw new Error(`${blockName} is not in inventory and cannot be crafted from what I carry.`);
    }
    const coordinatesGiven = [x, y, z].every((value) =>
      Number.isFinite(Number(value)) && value !== null && value !== ""
    );
    // "Place a block" with no position means right next to the body, the way
    // a player drops a block beside themselves; NaN coordinates never reach
    // the world.
    const target = coordinatesGiven
      ? new Vec3(
          Math.floor(Number(x)),
          Math.floor(Number(y)),
          Math.floor(Number(z))
        )
      : placementSpotBesideBody(bot);
    if (!target) {
      throw new Error(`No open spot beside me to place ${blockName}.`);
    }
    if (coordinatesGiven) {
      await bot.pathfinder.goto(new goals.GoalNear(target.x, target.y, target.z, 3));
    }
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
    const itemId = bot.registry.itemsByName[itemName]?.id;
    if (itemId === undefined) {
      throw new Error(`Unknown item ${itemName}.`);
    }
    // The 2 by 2 grid first. A recipe that needs the 3 by 3 grid uses a
    // crafting table within 32 blocks, the way a player walks to one, and
    // when none is near the body sets one down itself: the avatar says "I'll
    // make a pickaxe" before the command runs, and a craft that then fails
    // for want of a table makes that sentence untrue.
    let recipes = bot.recipesFor(itemId, null, 1, null);
    let craftingTable = null;
    if (!recipes.length) {
      await craftBasicIngredients(bot);
      recipes = bot.recipesFor(itemId, null, 1, null);
    }
    if (!recipes.length) {
      craftingTable =
        bot.findBlock({
          matching: (block) => block && block.name === "crafting_table",
          maxDistance: 32,
        }) || (await placeCraftingTableBesideBody(bot));
      if (craftingTable) {
        recipes = bot.recipesFor(itemId, null, 1, craftingTable);
      }
    }
    if (!recipes.length) {
      throw new Error(
        craftingTable
          ? `Not enough ingredients to craft ${itemName}.`
          : `Cannot craft ${itemName}: no crafting table nearby and not enough wood to make one.`
      );
    }
    if (craftingTable) {
      await bot.pathfinder.goto(
        new goals.GoalNear(craftingTable.position.x, craftingTable.position.y, craftingTable.position.z, 3)
      );
    }
    await bot.craft(recipes[0], Number(count) || 1, craftingTable);
    return `Crafted ${itemName}.`;
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

  // Walks to the player and drops every carried stack at their feet. "Give me
  // what you collected" needs this whole trip in one skill; a bare toss drops
  // items where the body stands, and goToPlayer alone never hands anything over.
  async giveCollected(bot, playerName) {
    if (await recordIfFake(bot, "giveCollected", [playerName])) {
      return;
    }
    const player = otherPlayerOrNamed(bot, playerName);
    if (!player) {
      throw new Error("No other player is nearby to give items to.");
    }
    const carried = bot.inventory?.items?.() || [];
    if (!carried.length) {
      throw new Error("Nothing collected to give.");
    }
    await bot.pathfinder.goto(
      new goals.GoalNear(player.position.x, player.position.y, player.position.z, 2)
    );
    await bot.lookAt(player.position.offset(0, 1.6, 0));
    while ((bot.inventory?.items?.() || []).length) {
      const stack = bot.inventory.items()[0];
      await bot.toss(stack.type, null, stack.count);
    }
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

// Every command the body understands: the original play skills, then
// Mindcraft's catalog under Mindcraft's names (a Mindcraft runner replaces an
// older runner of the same name, such as attack, which now fights until the
// target is gone instead of landing one hit), then the queries.
export const allCommandRunners = {
  ...skillRunners,
  ...mindcraftSkillRunners,
  placeHere: (bot, blockName) => skillRunners.placeBlock(bot, blockName),
  ...mindcraftQueryRunners,
};

export const QUERY_COMMAND_NAMES = Object.keys(mindcraftQueryRunners);

const COMMAND_NAME_BY_LOWERCASE = new Map(
  Object.keys(allCommandRunners).map((name) => [name.toLowerCase(), name])
);

export function resolveCommandName(name) {
  return COMMAND_NAME_BY_LOWERCASE.get(String(name || "").trim().replace(/^!/, "").toLowerCase()) || null;
}

// Runs one command and returns the runner's text result, if any.
export async function runSkill(bot, command) {
  const commandName = resolveCommandName(command.name);
  const runner = commandName ? allCommandRunners[commandName] : null;
  if (!runner) {
    throw new Error(`Unknown skill ${command.name}.`);
  }
  return runner(bot, ...(command.arguments || []));
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
