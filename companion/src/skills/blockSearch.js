import { Vec3 } from "vec3";

// Names a person or the avatar uses for "any tree" rather than one tree type.
const LOG_FAMILY_NAMES = new Set(["log", "logs", "wood", "woods", "tree", "trees"]);

function isLogBlockName(blockName) {
  return blockName.endsWith("_log") && !blockName.startsWith("stripped_");
}

// Block ids collectBlocks searches for, nearest first. The exact block comes
// first; a family ("log") or a near miss ("oak_log" in a dark oak forest,
// "iron_ore" underground where the ore is deepslate_iron_ore) falls back to
// every related block, so the job starts from the world snapshot without a
// look at the screen to learn which variant is standing there.
export function blockIdSearchOrder(registry, blockName) {
  const requested = String(blockName || "").trim().toLowerCase().replace(/\s+/g, "_");
  const blocksByName = registry?.blocksByName || {};
  const allNames = Object.keys(blocksByName);
  const idsForNames = (names) =>
    names.map((name) => blocksByName[name]?.id).filter((id) => id !== undefined);
  if (LOG_FAMILY_NAMES.has(requested)) {
    return [idsForNames(allNames.filter(isLogBlockName))];
  }
  const searchOrder = [];
  if (blocksByName[requested]) {
    searchOrder.push(idsForNames([requested]));
  }
  let relatedNames = [];
  if (isLogBlockName(requested)) {
    relatedNames = allNames.filter(isLogBlockName);
  } else if (requested.endsWith("_ore")) {
    relatedNames = allNames.filter(
      (name) => name === requested || name === `deepslate_${requested}`
    );
  } else if (!blocksByName[requested] && requested) {
    relatedNames = allNames.filter((name) => name.includes(requested));
  }
  const relatedIds = idsForNames(relatedNames);
  if (relatedIds.length) {
    searchOrder.push(relatedIds);
  }
  return searchOrder;
}

function blockIsOpen(block) {
  return !block || ["air", "cave_air", "void_air", "short_grass", "tall_grass", "snow"].includes(block.name);
}

// The first open block at foot level beside the body that stands on solid
// ground, starting with the direction the body faces.
export function placementSpotBesideBody(bot) {
  const feet = bot.entity?.position?.floored?.();
  if (!feet) {
    return null;
  }
  const yaw = Number(bot.entity.yaw) || 0;
  const facing = new Vec3(-Math.round(Math.sin(yaw)), 0, -Math.round(Math.cos(yaw)));
  const directions = [
    facing,
    new Vec3(1, 0, 0),
    new Vec3(-1, 0, 0),
    new Vec3(0, 0, 1),
    new Vec3(0, 0, -1),
  ].filter((direction) => direction.x !== 0 || direction.z !== 0);
  for (const direction of directions) {
    const spot = feet.plus(direction);
    if (blockIsOpen(bot.blockAt(spot)) && !blockIsOpen(bot.blockAt(spot.offset(0, -1, 0)))) {
      return spot;
    }
  }
  return null;
}

