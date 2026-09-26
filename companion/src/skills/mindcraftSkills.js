// Mindcraft's command catalog on the Neural Nexus body.
//
// Every command a Mindcraft agent accepts (kolbytn/mindcraft,
// src/agent/commands/actions.js and queries.js) has a runner here, under the
// Mindcraft name, so a player can type "!collectBlocks(oak_log, 10)" and the
// avatar can send the same command through act_in_minecraft. A runner returns
// a short text result, which the typed-command path posts in chat the way
// Mindcraft reports a command's output. "!newAction" is deliberately absent:
// Mindcraft runs model-written JavaScript for it, and this body runs only
// written skills.
//
// Companion-level state (the chat mute, the Neural Nexus thread, the standing
// goal, the hold, the modes) lives in the companion, not the bot; runners reach
// that state through ``bot.nexusHooks``, which index.js installs.

import pathfinderPackage from "mineflayer-pathfinder";
import { Vec3 } from "vec3";
import { blockIdSearchOrder } from "./blockSearch.js";

const { goals } = pathfinderPackage;

const DEFAULT_SEARCH_RANGE = 64;
const ATTACK_TIMEOUT_MS = 30000;
const CHEST_BLOCK_NAMES = ["chest", "trapped_chest", "barrel"];
const FURNACE_BLOCK_NAMES = ["furnace", "blast_furnace", "smoker"];
const DANGEROUS_BLOCK_NAMES = ["lava", "water"];

// Saved places outlive a reconnect: the bot object is rebuilt on every
// reconnect, the module is not.
const savedPlaces = new Map();

// A stop advances the body's job generation (see skillLibrary.stop); a long
// job captures the generation when the job starts and gives up once a later
// stop has moved the generation on.
function stopCheckFor(bot) {
  const startedGeneration = bot.nexusJobGeneration || 0;
  return () => (bot.nexusJobGeneration || 0) !== startedGeneration;
}

function hooksOf(bot) {
  return bot.nexusHooks || {};
}

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positionText(position) {
  return `${Math.round(position.x)}, ${Math.round(position.y)}, ${Math.round(position.z)}`;
}

function inventoryItem(bot, itemName) {
  return bot.inventory.items().find((entry) => entry.name === itemName) || null;
}

function inventoryCount(bot, itemName) {
  return bot.inventory
    .items()
    .filter((entry) => entry.name === itemName)
    .reduce((total, entry) => total + entry.count, 0);
}

function requireEntityPosition(bot) {
  if (!bot.entity?.position) {
    throw new Error("The body has not spawned yet.");
  }
  return bot.entity.position;
}

async function walkNear(bot, position, range = 2) {
  if (hooksOf(bot).modeIsOn?.("cheat")) {
    bot.chat(`/tp @s ${Math.floor(position.x)} ${Math.floor(position.y)} ${Math.floor(position.z)}`);
    return;
  }
  await bot.pathfinder.goto(new goals.GoalNear(position.x, position.y, position.z, range));
}

export function findPlayerEntity(bot, playerName) {
  const wanted = String(playerName || "").trim();
  if (wanted && wanted !== "player") {
    const named = bot.players?.[wanted]?.entity;
    if (named) {
      return named;
    }
    const byUsername = Object.values(bot.entities || {}).find(
      (entity) => entity.username === wanted
    );
    if (byUsername) {
      return byUsername;
    }
    return null;
  }
  const origin = bot.entity?.position;
  return (
    Object.values(bot.entities || {})
      .filter((entity) => entity.type === "player" && entity.username !== bot.username)
      .sort((left, right) =>
        origin ? left.position.distanceTo(origin) - right.position.distanceTo(origin) : 0
      )[0] || null
  );
}

function entityMatches(entity, typeName) {
  const wanted = String(typeName || "").trim().toLowerCase();
  return [entity.name, entity.username, entity.displayName]
    .filter(Boolean)
    .some((name) => String(name).toLowerCase() === wanted);
}

export function nearestEntityOfType(bot, typeName, range = DEFAULT_SEARCH_RANGE) {
  const origin = requireEntityPosition(bot);
  return (
    Object.values(bot.entities || {})
      .filter((entity) => entity !== bot.entity && entity.position && entityMatches(entity, typeName))
      .filter((entity) => entity.position.distanceTo(origin) <= range)
      .sort((left, right) => left.position.distanceTo(origin) - right.position.distanceTo(origin))[0] ||
    null
  );
}

export function isHostileEntity(entity) {
  return entity?.type === "hostile" || String(entity?.kind || "").toLowerCase().includes("hostile");
}

function nearestBlockNamed(bot, blockNames, range = 32) {
  return bot.findBlock({
    matching: (block) => block && blockNames.includes(block.name),
    maxDistance: range,
  });
}

async function attackUntilGone(bot, target) {
  const started = Date.now();
  const wasStopped = stopCheckFor(bot);
  while (bot.entities?.[target.id] && Date.now() - started < ATTACK_TIMEOUT_MS) {
    if (wasStopped()) {
      return false;
    }
    const distance = target.position.distanceTo(bot.entity.position);
    if (distance > 3) {
      bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true);
    }
    await bot.lookAt(target.position.offset(0, (target.height || 1.6) * 0.8, 0));
    if (distance <= 3.5) {
      bot.attack(target);
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  bot.pathfinder.setGoal(null);
  return !bot.entities?.[target.id];
}

async function equipBestWeapon(bot) {
  const weaponOrder = ["netherite_sword", "diamond_sword", "iron_sword", "stone_sword", "golden_sword", "wooden_sword", "netherite_axe", "diamond_axe", "iron_axe", "stone_axe", "wooden_axe"];
  for (const weaponName of weaponOrder) {
    const weapon = inventoryItem(bot, weaponName);
    if (weapon) {
      await bot.equip(weapon, "hand");
      return;
    }
  }
}

async function openNearestContainer(bot, blockNames, label) {
  const block = nearestBlockNamed(bot, blockNames, 32);
  if (!block) {
    throw new Error(`No ${label} within 32 blocks.`);
  }
  await walkNear(bot, block.position, 3);
  return { block, container: await bot.openContainer(block) };
}

function describeItems(items) {
  const counts = new Map();
  for (const item of items) {
    counts.set(item.name, (counts.get(item.name) || 0) + item.count);
  }
  return [...counts.entries()].map(([name, count]) => `${count} ${name}`).join(", ") || "empty";
}

export const mindcraftSkillRunners = {
  // --- Control -------------------------------------------------------------
  async stfu(bot) {
    hooksOf(bot).setQuiet?.(true);
    return "Quiet until someone talks to me again.";
  },

  async restart(bot) {
    setTimeout(() => bot.quit("restart requested"), 200);
    return "Restarting; back in a few seconds.";
  },

  async clearChat(bot) {
    hooksOf(bot).clearChat?.();
    return "Started a fresh conversation.";
  },

  // --- Movement ------------------------------------------------------------
  async goToPlayer(bot, playerName, closeness = 3) {
    const player = findPlayerEntity(bot, playerName);
    if (!player) {
      throw new Error(`${playerName || "No player"} is not in range.`);
    }
    await walkNear(bot, player.position, numberOr(closeness, 3));
    return `Reached ${player.username || "the player"}.`;
  },

  async followPlayer(bot, playerName, followDistance = 3) {
    const player = findPlayerEntity(bot, playerName);
    if (!player) {
      throw new Error(`${playerName || "No player"} is not in range to follow.`);
    }
    bot.pathfinder.setGoal(new goals.GoalFollow(player, numberOr(followDistance, 3)), true);
    return `Following ${player.username || "the player"}.`;
  },

  async goToCoordinates(bot, x, y, z, closeness = 1) {
    const target = new Vec3(Number(x), Number(y), Number(z));
    if (![target.x, target.y, target.z].every(Number.isFinite)) {
      throw new Error("goToCoordinates needs x, y and z numbers.");
    }
    await walkNear(bot, target, numberOr(closeness, 1));
    return `Arrived near ${positionText(target)}.`;
  },

  async searchForBlock(bot, blockName, searchRange = DEFAULT_SEARCH_RANGE) {
    const range = numberOr(searchRange, DEFAULT_SEARCH_RANGE);
    for (const blockIds of blockIdSearchOrder(bot.registry, blockName)) {
      const block = bot.findBlock({ matching: blockIds, maxDistance: range });
      if (block) {
        await walkNear(bot, block.position, 2);
        return `Found ${block.name} at ${positionText(block.position)}.`;
      }
    }
    throw new Error(`No ${blockName} within ${range} blocks.`);
  },

  async searchForEntity(bot, entityType, searchRange = DEFAULT_SEARCH_RANGE) {
    const range = numberOr(searchRange, DEFAULT_SEARCH_RANGE);
    const entity = nearestEntityOfType(bot, entityType, range);
    if (!entity) {
      throw new Error(`No ${entityType} within ${range} blocks.`);
    }
    await walkNear(bot, entity.position, 2);
    return `Found ${entityType} at ${positionText(entity.position)}.`;
  },

  async moveAway(bot, distance = 10) {
    const origin = requireEntityPosition(bot).clone();
    await bot.pathfinder.goto(
      new goals.GoalInvert(new goals.GoalNear(origin.x, origin.y, origin.z, numberOr(distance, 10)))
    );
    return `Moved ${numberOr(distance, 10)} blocks away.`;
  },

  async goToSurface(bot) {
    const origin = requireEntityPosition(bot).floored();
    for (let y = 319; y > origin.y; y -= 1) {
      const block = bot.blockAt(new Vec3(origin.x, y, origin.z));
      if (block && !["air", "cave_air", "void_air"].includes(block.name)) {
        await walkNear(bot, new Vec3(origin.x, y + 1, origin.z), 1);
        return `On the surface at y=${y + 1}.`;
      }
    }
    return "Already at the surface.";
  },

  async digDown(bot, distance = 10) {
    const depth = numberOr(distance, 10);
    const wasStopped = stopCheckFor(bot);
    for (let dug = 0; dug < depth; dug += 1) {
      if (wasStopped()) {
        return `Stopped after digging ${dug} blocks down.`;
      }
      const feet = requireEntityPosition(bot).floored();
      const below = bot.blockAt(feet.offset(0, -1, 0));
      const twoBelow = bot.blockAt(feet.offset(0, -2, 0));
      if (twoBelow && DANGEROUS_BLOCK_NAMES.includes(twoBelow.name)) {
        return `Stopped: ${twoBelow.name} below after ${dug} blocks.`;
      }
      if (below && below.name !== "air") {
        await bot.dig(below);
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    return `Dug down ${depth} blocks.`;
  },

  async stay(bot, seconds = 30) {
    bot.pathfinder.setGoal(null);
    bot.clearControlStates();
    hooksOf(bot).holdFor?.(numberOr(seconds, 30));
    const duration = numberOr(seconds, 30);
    return duration < 0 ? "Staying here until told otherwise." : `Staying here for ${duration} seconds.`;
  },

  // --- Places --------------------------------------------------------------
  async rememberHere(bot, placeName) {
    if (!placeName) {
      throw new Error("rememberHere needs a name.");
    }
    savedPlaces.set(String(placeName), requireEntityPosition(bot).clone());
    return `Remembered this spot as ${placeName}.`;
  },

  async goToRememberedPlace(bot, placeName) {
    const place = savedPlaces.get(String(placeName));
    if (!place) {
      throw new Error(`No saved place named ${placeName}.`);
    }
    await walkNear(bot, place, 1);
    return `Back at ${placeName}.`;
  },

  // --- Items ---------------------------------------------------------------
  async givePlayer(bot, playerName, itemName, count = 1) {
    const player = findPlayerEntity(bot, playerName);
    if (!player) {
      throw new Error(`${playerName} is not in range.`);
    }
    const item = inventoryItem(bot, itemName);
    if (!item) {
      throw new Error(`${itemName} is not in inventory.`);
    }
    await walkNear(bot, player.position, 2);
    await bot.lookAt(player.position.offset(0, 1.6, 0));
    const amount = Math.min(numberOr(count, 1), inventoryCount(bot, itemName));
    await bot.toss(item.type, null, amount);
    return `Gave ${amount} ${itemName} to ${player.username}.`;
  },

  async consume(bot, itemName) {
    const item = inventoryItem(bot, itemName);
    if (!item) {
      throw new Error(`${itemName} is not in inventory.`);
    }
    await bot.equip(item, "hand");
    await bot.consume();
    return `Consumed ${itemName}.`;
  },

  async discard(bot, itemName, count = -1) {
    const available = inventoryCount(bot, itemName);
    if (!available) {
      throw new Error(`${itemName} is not in inventory.`);
    }
    const amount = numberOr(count, -1) < 0 ? available : Math.min(numberOr(count, 1), available);
    const item = inventoryItem(bot, itemName);
    await bot.toss(item.type, null, amount);
    return `Discarded ${amount} ${itemName}.`;
  },

  // --- Chests --------------------------------------------------------------
  async putInChest(bot, itemName, count = -1) {
    const available = inventoryCount(bot, itemName);
    if (!available) {
      throw new Error(`${itemName} is not in inventory.`);
    }
    const { container } = await openNearestContainer(bot, CHEST_BLOCK_NAMES, "chest");
    try {
      const amount = numberOr(count, -1) < 0 ? available : Math.min(numberOr(count, 1), available);
      await container.deposit(inventoryItem(bot, itemName).type, null, amount);
      return `Put ${amount} ${itemName} in the chest.`;
    } finally {
      container.close();
    }
  },

  async takeFromChest(bot, itemName, count = -1) {
    const { container } = await openNearestContainer(bot, CHEST_BLOCK_NAMES, "chest");
    try {
      const stored = container.containerItems().filter((entry) => entry.name === itemName);
      const available = stored.reduce((total, entry) => total + entry.count, 0);
      if (!available) {
        throw new Error(`The chest has no ${itemName}.`);
      }
      const amount = numberOr(count, -1) < 0 ? available : Math.min(numberOr(count, 1), available);
      await container.withdraw(stored[0].type, null, amount);
      return `Took ${amount} ${itemName} from the chest.`;
    } finally {
      container.close();
    }
  },

  async viewChest(bot) {
    const { container } = await openNearestContainer(bot, CHEST_BLOCK_NAMES, "chest");
    try {
      return `Chest holds: ${describeItems(container.containerItems())}.`;
    } finally {
      container.close();
    }
  },

  // --- Crafting and smelting -----------------------------------------------
  async smeltItem(bot, itemName, count = 1) {
    const amount = Math.max(1, numberOr(count, 1));
    const furnaceBlock = nearestBlockNamed(bot, FURNACE_BLOCK_NAMES, 32);
    if (!furnaceBlock) {
      throw new Error("No furnace within 32 blocks.");
    }
    const input = inventoryItem(bot, itemName);
    if (!input) {
      throw new Error(`${itemName} is not in inventory.`);
    }
    const fuel = ["coal", "charcoal", "coal_block"]
      .map((fuelName) => inventoryItem(bot, fuelName))
      .find(Boolean) || bot.inventory.items().find((entry) => entry.name.endsWith("_planks") || entry.name.endsWith("_log"));
    if (!fuel) {
      throw new Error("No coal, charcoal, planks or logs for fuel.");
    }
    await walkNear(bot, furnaceBlock.position, 3);
    const furnace = await bot.openFurnace(furnaceBlock);
    try {
      await furnace.putInput(input.type, null, Math.min(amount, inventoryCount(bot, itemName)));
      await furnace.putFuel(fuel.type, null, Math.min(Math.ceil(amount / 8) + 1, fuel.count));
      const deadline = Date.now() + amount * 10500 + 3000;
      let collected = 0;
      while (collected < amount && Date.now() < deadline) {
        if (furnace.outputItem()) {
          const output = await furnace.takeOutput();
          collected += output?.count || 1;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      return `Smelted ${collected} ${itemName}.`;
    } finally {
      furnace.close();
    }
  },

  async clearFurnace(bot) {
    const furnaceBlock = nearestBlockNamed(bot, FURNACE_BLOCK_NAMES, 32);
    if (!furnaceBlock) {
      throw new Error("No furnace within 32 blocks.");
    }
    await walkNear(bot, furnaceBlock.position, 3);
    const furnace = await bot.openFurnace(furnaceBlock);
    try {
      if (furnace.inputItem()) await furnace.takeInput();
      if (furnace.fuelItem()) await furnace.takeFuel();
      if (furnace.outputItem()) await furnace.takeOutput();
      return "Emptied the furnace.";
    } finally {
      furnace.close();
    }
  },

  // --- Combat --------------------------------------------------------------
  async attack(bot, entityType) {
    const target = nearestEntityOfType(bot, entityType, 24);
    if (!target) {
      throw new Error(`No ${entityType} within 24 blocks.`);
    }
    await equipBestWeapon(bot);
    const defeated = await attackUntilGone(bot, target);
    return defeated ? `Defeated the ${entityType}.` : `Stopped attacking the ${entityType}.`;
  },

  async attackPlayer(bot, playerName) {
    const player = findPlayerEntity(bot, playerName);
    if (!player || !playerName || playerName === "player") {
      throw new Error(`${playerName || "That player"} is not in range.`);
    }
    await equipBestWeapon(bot);
    const defeated = await attackUntilGone(bot, player);
    return defeated ? `${playerName} is down.` : `Stopped attacking ${playerName}.`;
  },

  // --- Life ----------------------------------------------------------------
  async goToBed(bot) {
    const bed = bot.findBlock({
      matching: (block) => block && String(block.name).endsWith("_bed"),
      maxDistance: 32,
    });
    if (!bed) {
      throw new Error("No bed within 32 blocks.");
    }
    await walkNear(bot, bed.position, 2);
    await bot.sleep(bed);
    return "Asleep.";
  },

  // --- Looking -------------------------------------------------------------
  async lookAtPlayer(bot, playerName, direction = "at") {
    const player = findPlayerEntity(bot, playerName);
    if (!player) {
      throw new Error(`${playerName || "No player"} is not in range.`);
    }
    if (String(direction).toLowerCase() === "with") {
      await bot.look(player.yaw, player.pitch, true);
      return `Looking the same way as ${player.username}.`;
    }
    await bot.lookAt(player.position.offset(0, 1.6, 0), true);
    return `Looking at ${player.username}.`;
  },

  async lookAtPosition(bot, x, y, z) {
    const target = new Vec3(Number(x), Number(y), Number(z));
    if (![target.x, target.y, target.z].every(Number.isFinite)) {
      throw new Error("lookAtPosition needs x, y and z numbers.");
    }
    await bot.lookAt(target, true);
    return `Looking at ${positionText(target)}.`;
  },

  // --- Use -----------------------------------------------------------------
  async useOn(bot, toolName, targetName = "nothing") {
    if (toolName && toolName !== "hand") {
      const tool = inventoryItem(bot, toolName);
      if (!tool) {
        throw new Error(`${toolName} is not in inventory.`);
      }
      await bot.equip(tool, "hand");
    }
    const wanted = String(targetName || "nothing");
    if (wanted === "nothing") {
      bot.activateItem();
      return `Used ${toolName}.`;
    }
    const entity = nearestEntityOfType(bot, wanted, 16) || findPlayerEntity(bot, wanted);
    if (entity) {
      await walkNear(bot, entity.position, 2);
      await bot.lookAt(entity.position.offset(0, (entity.height || 1) * 0.5, 0));
      await bot.useOn(entity);
      return `Used ${toolName} on the ${wanted}.`;
    }
    const block = nearestBlockNamed(bot, [wanted], 16);
    if (block) {
      await walkNear(bot, block.position, 3);
      await bot.activateBlock(block);
      return `Used ${toolName} on the ${wanted}.`;
    }
    throw new Error(`No ${wanted} within 16 blocks.`);
  },

  // --- Villagers -----------------------------------------------------------
  async showVillagerTrades(bot, villagerId) {
    const villagerEntity = villagerEntityById(bot, villagerId);
    await walkNear(bot, villagerEntity.position, 2);
    const villager = await bot.openVillager(villagerEntity);
    try {
      const trades = (villager.trades || []).map((trade, index) => {
        const second = trade.inputItem2 ? ` + ${trade.inputItem2.count} ${trade.inputItem2.name}` : "";
        return `${index}: ${trade.inputItem1.count} ${trade.inputItem1.name}${second} -> ${trade.outputItem.count} ${trade.outputItem.name}${trade.tradeDisabled ? " (sold out)" : ""}`;
      });
      return trades.length ? trades.join("; ") : "This villager has no trades.";
    } finally {
      villager.close();
    }
  },

  async tradeWithVillager(bot, villagerId, tradeIndex, count = 1) {
    const villagerEntity = villagerEntityById(bot, villagerId);
    await walkNear(bot, villagerEntity.position, 2);
    const villager = await bot.openVillager(villagerEntity);
    try {
      await bot.trade(villager, numberOr(tradeIndex, 0), numberOr(count, 1));
      return `Traded ${numberOr(count, 1)} time(s) with trade ${numberOr(tradeIndex, 0)}.`;
    } finally {
      villager.close();
    }
  },

  // --- Autonomy ------------------------------------------------------------
  async goal(bot, goalText) {
    if (!goalText) {
      throw new Error("goal needs a description of what to work toward.");
    }
    hooksOf(bot).setGoal?.(String(goalText));
    return `Working toward: ${goalText}.`;
  },

  async endGoal(bot) {
    hooksOf(bot).setGoal?.(null);
    return "Goal ended.";
  },

  async setMode(bot, modeName, on = true) {
    const enabled = !["false", "off", "0", "no"].includes(String(on).toLowerCase());
    const changed = hooksOf(bot).setMode?.(String(modeName), enabled);
    if (changed === false) {
      throw new Error(`No mode named ${modeName}. Try !modes.`);
    }
    return `Mode ${modeName} is ${enabled ? "on" : "off"}.`;
  },

  // --- Talking to other bots -----------------------------------------------
  async startConversation(bot, playerName, message) {
    if (!playerName || !message) {
      throw new Error("startConversation needs a player name and a message.");
    }
    bot.whisper(String(playerName), String(message));
    return `Said to ${playerName}: ${message}`;
  },

  async endConversation(bot, playerName) {
    return `Ended the conversation with ${playerName || "that player"}.`;
  },

  async newAction(_bot) {
    throw new Error("newAction runs model-written code and is not offered on this body.");
  },
};

function villagerEntityById(bot, villagerId) {
  const byId = bot.entities?.[Number(villagerId)];
  const villagerEntity =
    byId && ["villager", "wandering_trader"].includes(byId.name)
      ? byId
      : nearestEntityOfType(bot, "villager", 16);
  if (!villagerEntity) {
    throw new Error("No villager nearby.");
  }
  return villagerEntity;
}

// --- Queries: facts the model or the player can ask for without a look ------

export const mindcraftQueryRunners = {
  async stats(bot) {
    const position = requireEntityPosition(bot);
    const timeOfDay = bot.time?.timeOfDay ?? 0;
    const period = timeOfDay < 6000 ? "morning" : timeOfDay < 12000 ? "afternoon" : timeOfDay < 18000 ? "night" : "late night";
    return [
      `position ${positionText(position)}`,
      `dimension ${bot.game?.dimension || "unknown"}`,
      `health ${Math.round(bot.health ?? 0)}/20`,
      `hunger ${Math.round(bot.food ?? 0)}/20`,
      `time ${period}`,
    ].join(", ");
  },

  async inventory(bot) {
    const held = bot.heldItem?.name || "nothing";
    return `Holding ${held}. Inventory: ${describeItems(bot.inventory.items())}.`;
  },

  async nearbyBlocks(bot) {
    const positions = bot.findBlocks({
      matching: (block) => block && !["air", "cave_air", "void_air"].includes(block.name),
      maxDistance: 16,
      count: 400,
    });
    const names = [...new Set(positions.map((position) => bot.blockAt(position)?.name).filter(Boolean))];
    return `Nearby blocks: ${names.slice(0, 40).join(", ") || "none"}.`;
  },

  async craftable(bot) {
    const table = nearestBlockNamed(bot, ["crafting_table"], 8);
    const names = Object.values(bot.registry.itemsByName)
      .filter((item) => (bot.recipesFor(item.id, null, 1, table) || []).length)
      .map((item) => item.name);
    return `Craftable now: ${names.slice(0, 40).join(", ") || "nothing"}.`;
  },

  async entities(bot) {
    const origin = requireEntityPosition(bot);
    const nearby = Object.values(bot.entities || {})
      .filter((entity) => entity !== bot.entity && entity.position && entity.position.distanceTo(origin) <= 24)
      .map((entity) => `${entity.username || entity.name} (id ${entity.id}, ${Math.round(entity.position.distanceTo(origin))}m)`);
    return `Nearby: ${nearby.slice(0, 20).join(", ") || "nothing"}.`;
  },

  async modes(bot) {
    return hooksOf(bot).describeModes?.() || "Modes are unavailable.";
  },

  async savedPlaces(_bot) {
    const places = [...savedPlaces.entries()].map(([name, position]) => `${name} at ${positionText(position)}`);
    return `Saved places: ${places.join("; ") || "none"}.`;
  },

  async getCraftingPlan(bot, itemName, quantity = 1) {
    const item = bot.registry.itemsByName[itemName];
    if (!item) {
      throw new Error(`Unknown item ${itemName}.`);
    }
    const table = nearestBlockNamed(bot, ["crafting_table"], 8);
    const recipe = (bot.recipesAll(item.id, null, true) || [])[0];
    if (!recipe) {
      return `${itemName} has no crafting recipe; gather or smelt it instead.`;
    }
    const needed = new Map();
    for (const ingredient of recipe.delta.filter((entry) => entry.count < 0)) {
      const ingredientName = bot.registry.items[ingredient.id]?.name || String(ingredient.id);
      needed.set(ingredientName, (needed.get(ingredientName) || 0) + -ingredient.count);
    }
    const perCraft = recipe.result?.count || 1;
    const crafts = Math.ceil(numberOr(quantity, 1) / perCraft);
    const lines = [...needed.entries()].map(([name, count]) => {
      const required = count * crafts;
      const carried = inventoryCount(bot, name);
      return `${required} ${name} (have ${carried})`;
    });
    const tableNote = recipe.requiresTable ? (table ? " Uses the nearby crafting table." : " Needs a crafting table.") : "";
    return `${quantity} ${itemName}: ${lines.join(", ")}.${tableNote}`;
  },

  async searchWiki(_bot, query) {
    return `Wiki search is not available on this body; ask Neural Nexus about ${query || "it"} instead.`;
  },
};
