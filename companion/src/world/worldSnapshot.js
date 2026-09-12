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
    `time: ${bot.time?.timeOfDay ?? "unknown"}`,
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
