function blockNameAt(bot, position) {
  try {
    const block = bot.blockAt(position);
    return block?.name || "air";
  } catch {
    return "unknown";
  }
}

function inventoryLines(bot) {
  const items = bot.inventory?.items?.() || [];
  if (items.length === 0) {
    return "empty";
  }
  return items
    .map((item) => `${item.count} ${item.name}`)
    .slice(0, 40)
    .join(", ");
}

function nearbyPlayerLines(bot) {
  const selfId = bot.entity?.id;
  const players = Object.values(bot.entities || {}).filter(
    (entity) => entity.type === "player" && entity.id !== selfId
  );
  if (players.length === 0) {
    return "none";
  }
  return players
    .slice(0, 8)
    .map((entity) => {
      const distance = bot.entity
        ? bot.entity.position.distanceTo(entity.position).toFixed(1)
        : "?";
      return `${entity.username || "player"} distance=${distance} at ${entity.position.x.toFixed(1)},${entity.position.y.toFixed(1)},${entity.position.z.toFixed(1)}`;
    })
    .join("; ");
}

function nearbyBlockLines(bot) {
  if (!bot.findBlocks || !bot.entity) {
    return "unavailable";
  }
  try {
    const positions = bot.findBlocks({
      matching: (block) =>
        block &&
        block.name !== "air" &&
        block.name !== "cave_air" &&
        block.name !== "void_air",
      maxDistance: 8,
      count: 16,
    });
    const names = [
      ...new Set(
        positions.map((position) => blockNameAt(bot, position))
      ),
    ];
    return names.join(", ") || "none";
  } catch {
    return "unavailable";
  }
}

// Weather as the player sees it. bot.isRaining is true for rain and snow;
// thunderState above zero means a thunderstorm.
export function weatherText(bot) {
  if (!bot?.isRaining) {
    return "clear";
  }
  return (bot.thunderState || 0) > 0 ? "thunderstorm" : "raining (snowing in cold biomes)";
}

// Minecraft's day is 24000 ticks: 0 is sunrise, 6000 noon, 12000 sunset,
// 18000 midnight.
export function timeOfDayText(bot) {
  const ticks = bot?.time?.timeOfDay;
  if (typeof ticks !== "number") {
    return "unknown";
  }
  if (ticks < 1000) return "sunrise";
  if (ticks < 6000) return "morning";
  if (ticks < 11500) return "afternoon";
  if (ticks < 13000) return "sunset";
  if (ticks < 23000) return "night";
  return "dawn";
}

export function buildWorldSnapshotText(bot) {
  if (!bot?.entity) {
    return "The avatar has not spawned yet.";
  }
  const position = bot.entity.position;
  const held = bot.heldItem?.name || "nothing";
  const biome = bot.blockAt(position)?.biome?.name || "unknown";
  return [
    `position: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`,
    `yaw: ${bot.entity.yaw?.toFixed?.(2) ?? bot.entity.yaw} pitch: ${bot.entity.pitch?.toFixed?.(2) ?? bot.entity.pitch}`,
    `dimension: ${bot.game?.dimension || "unknown"}`,
    `biome: ${biome}`,
    `time: ${timeOfDayText(bot)} (tick ${bot.time?.timeOfDay ?? "unknown"})`,
    `weather: ${weatherText(bot)}`,
    `health: ${bot.health} food: ${bot.food}`,
    `held: ${held}`,
    `inventory: ${inventoryLines(bot)}`,
    `nearby players: ${nearbyPlayerLines(bot)}`,
    `block under feet: ${blockNameAt(bot, position.offset(0, -1, 0))}`,
    `nearby blocks: ${nearbyBlockLines(bot)}`,
  ].join("\n");
}

export function firstOtherPlayer(bot) {
  const selfId = bot.entity?.id;
  return Object.values(bot.entities || {}).find(
    (entity) => entity.type === "player" && entity.id !== selfId
  );
}
