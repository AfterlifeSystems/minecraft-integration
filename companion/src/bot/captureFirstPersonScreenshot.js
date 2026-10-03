import { Vec3 } from "vec3";
import { encode as encodeJpeg } from "jpeg-js";
import { skinColorsForUrl, UNKNOWN_SKIN_COLORS } from "./playerSkinColors.js";

const IMAGE_WIDTH = 160;
const IMAGE_HEIGHT = 90;
const FIELD_OF_VIEW_DEGREES = 70;
const RAY_DISTANCE = 48;

const BLOCK_COLORS = {
  air: [135, 206, 235],
  cave_air: [20, 20, 24],
  void_air: [8, 8, 12],
  grass_block: [80, 160, 60],
  dirt: [120, 85, 55],
  oak_log: [110, 80, 40],
  oak_leaves: [50, 120, 45],
  oak_planks: [160, 130, 70],
  stone: [120, 120, 120],
  cobblestone: [110, 110, 110],
  sand: [220, 210, 150],
  water: [40, 80, 180],
  lava: [220, 80, 20],
  coal_ore: [50, 50, 50],
  iron_ore: [180, 160, 140],
  crafting_table: [140, 100, 50],
  furnace: [90, 90, 90],
  chest: [150, 100, 40],
  default: [90, 100, 80],
};

function colorForBlockName(blockName) {
  if (!blockName) {
    return BLOCK_COLORS.air;
  }
  if (BLOCK_COLORS[blockName]) {
    return BLOCK_COLORS[blockName];
  }
  if (blockName.includes("log")) return BLOCK_COLORS.oak_log;
  if (blockName.includes("leaves")) return BLOCK_COLORS.oak_leaves;
  if (blockName.includes("planks")) return BLOCK_COLORS.oak_planks;
  if (blockName.includes("ore")) return BLOCK_COLORS.iron_ore;
  if (blockName.includes("water")) return BLOCK_COLORS.water;
  if (blockName.includes("grass")) return BLOCK_COLORS.grass_block;
  return BLOCK_COLORS.default;
}

// The sky and the light change with weather and time of day. Without this the
// drawn view always had a clear blue sky, and "what do you see?" described
// sunshine in the middle of a thunderstorm.
const SKY_COLORS = {
  clear_day: [135, 206, 235],
  rain_day: [120, 128, 140],
  thunder_day: [80, 86, 98],
  clear_night: [12, 16, 40],
  rain_night: [18, 20, 28],
  sunset: [230, 140, 90],
};
const RAIN_STREAK_COLOR = [190, 200, 215];

export function viewConditions(bot) {
  const ticks = typeof bot?.time?.timeOfDay === "number" ? bot.time.timeOfDay : 6000;
  const isNight = ticks >= 13000 && ticks < 23000;
  const isSunset = (ticks >= 11500 && ticks < 13000) || ticks >= 23000;
  const raining = Boolean(bot?.isRaining);
  const thundering = raining && (bot?.thunderState || 0) > 0;
  let sky = SKY_COLORS.clear_day;
  if (isNight) sky = raining ? SKY_COLORS.rain_night : SKY_COLORS.clear_night;
  else if (thundering) sky = SKY_COLORS.thunder_day;
  else if (raining) sky = SKY_COLORS.rain_day;
  else if (isSunset) sky = SKY_COLORS.sunset;
  let brightness = 1;
  if (isNight) brightness = 0.35;
  else if (thundering) brightness = 0.6;
  else if (raining) brightness = 0.75;
  else if (isSunset) brightness = 0.8;
  return { sky, brightness, raining };
}

// Mineflayer's own view direction (ray_trace.js getViewDirection):
// (-sin(yaw) cos(pitch), sin(pitch), -cos(yaw) cos(pitch)). A larger yaw turns
// the body to the body's left and a larger pitch looks up, so a pixel right of
// centre subtracts from the yaw and a pixel below centre subtracts from the
// pitch. Adding both offsets drew the view mirrored left to right and drew a
// body looking up as looking down (2026-10-02: "a brown tree on the left"
// for a dirt column the player saw on the right).
function lookDirection(yaw, pitch, offsetRight, offsetDown) {
  const lookYaw = yaw - offsetRight;
  const lookPitch = pitch - offsetDown;
  return new Vec3(
    -Math.sin(lookYaw) * Math.cos(lookPitch),
    Math.sin(lookPitch),
    -Math.cos(lookYaw) * Math.cos(lookPitch)
  );
}

// Player characters are drawn so a look can show what a player looks like
// ("what do I look like?" is answered by turning to the player, then looking).
// Parts of the 1.8-block player model in the player's own frame: x across the
// body (the player's right is +x), y up from the feet, z front to back.
const PLAYER_PARTS = [
  { part: "legs", armorSlot: 2, box: [-0.25, 0, -0.125, 0.25, 0.3, 0.125] },
  { part: "legs", armorSlot: 3, box: [-0.25, 0.3, -0.125, 0.25, 0.75, 0.125] },
  { part: "torso", armorSlot: 4, box: [-0.25, 0.75, -0.125, 0.25, 1.5, 0.125] },
  { part: "arms", armorSlot: 4, box: [-0.5, 0.75, -0.125, -0.25, 1.5, 0.125] },
  { part: "arms", armorSlot: 4, box: [0.25, 0.75, -0.125, 0.5, 1.5, 0.125] },
  { part: "head", armorSlot: 5, box: [-0.25, 1.5, -0.25, 0.25, 2.0, 0.25] },
];
const PLAYER_DRAW_DISTANCE = 32;

const ARMOR_MATERIAL_COLORS = {
  leather: [160, 101, 64],
  chainmail: [150, 150, 150],
  iron: [216, 216, 216],
  golden: [250, 215, 60],
  diamond: [90, 220, 210],
  netherite: [70, 60, 65],
  turtle: [70, 160, 60],
};

function armorColor(itemName) {
  if (!itemName) return null;
  const material = Object.keys(ARMOR_MATERIAL_COLORS).find((name) =>
    itemName.startsWith(`${name}_`)
  );
  return material ? ARMOR_MATERIAL_COLORS[material] : [120, 120, 120];
}

// Distance along the ray to an axis-aligned box, or Infinity when the ray
// misses the box (the slab method).
function rayBoxDistance(origin, direction, box) {
  let nearest = 0;
  let farthest = Infinity;
  const axes = [
    [origin.x, direction.x, box[0], box[3]],
    [origin.y, direction.y, box[1], box[4]],
    [origin.z, direction.z, box[2], box[5]],
  ];
  for (const [start, step, low, high] of axes) {
    if (Math.abs(step) < 1e-9) {
      if (start < low || start > high) return Infinity;
      continue;
    }
    let entry = (low - start) / step;
    let exit = (high - start) / step;
    if (entry > exit) [entry, exit] = [exit, entry];
    nearest = Math.max(nearest, entry);
    farthest = Math.min(farthest, exit);
    if (nearest > farthest) return Infinity;
  }
  return nearest;
}

// The nearest player part a ray hits: { distance, color } or null. The ray is
// turned into each player's own frame, so the arms sit at the player's sides
// whichever way the player faces.
function nearestPlayerHit(eye, direction, playerFigures) {
  let nearestHit = null;
  for (const figure of playerFigures) {
    const relative = eye.minus(figure.position);
    const cosine = Math.cos(figure.yaw);
    const sine = Math.sin(figure.yaw);
    // Facing direction of yaw is (-sin, 0, -cos); the player's right is
    // (cos, 0, -sin). Local x = right, local z = backward.
    const toLocal = (vector) =>
      new Vec3(
        vector.x * cosine - vector.z * sine,
        vector.y,
        vector.x * sine + vector.z * cosine
      );
    const localOrigin = toLocal(relative);
    const localDirection = toLocal(direction);
    for (const piece of PLAYER_PARTS) {
      const distance = rayBoxDistance(localOrigin, localDirection, piece.box);
      if (distance < (nearestHit?.distance ?? Infinity)) {
        const worn = armorColor(figure.equipment[piece.armorSlot]?.name);
        nearestHit = { distance, color: worn || figure.colors[piece.part] };
      }
    }
  }
  return nearestHit;
}

function blockHitDistance(eye, hit) {
  if (!hit) return Infinity;
  if (hit.intersect) return eye.distanceTo(hit.intersect);
  if (hit.position) return eye.distanceTo(hit.position.offset(0.5, 0.5, 0.5));
  return Infinity;
}

// The other players near the body, with the colours to draw them in.
export function playerFiguresNear(bot, colorsByUsername = {}) {
  const selfId = bot?.entity?.id;
  const eye = bot?.entity?.position;
  return Object.values(bot?.entities || {})
    .filter(
      (entity) =>
        entity?.type === "player" &&
        entity.id !== selfId &&
        entity.position &&
        (!eye || eye.distanceTo(entity.position) <= PLAYER_DRAW_DISTANCE)
    )
    .map((entity) => ({
      position: entity.position,
      yaw: entity.yaw || 0,
      equipment: entity.equipment || [],
      colors: colorsByUsername[entity.username] || UNKNOWN_SKIN_COLORS,
    }));
}

export function renderFirstPersonJpeg(bot, {
  width = IMAGE_WIDTH,
  height = IMAGE_HEIGHT,
  playerFigures = playerFiguresNear(bot),
} = {}) {
  if (!bot?.entity || typeof bot.world?.raycast !== "function") {
    return null;
  }
  const eye = bot.entity.position.offset(0, bot.entity.eyeHeight || 1.62, 0);
  const yaw = bot.entity.yaw;
  const pitch = bot.entity.pitch;
  const fov = (FIELD_OF_VIEW_DEGREES * Math.PI) / 180;
  const aspect = width / height;
  const pixels = Buffer.alloc(width * height * 4);
  const { sky, brightness, raining } = viewConditions(bot);

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const offsetRight = ((column / (width - 1) - 0.5) * fov * aspect);
      const offsetDown = ((row / (height - 1) - 0.5) * fov);
      const direction = lookDirection(yaw, pitch, offsetRight, offsetDown).normalize();
      let blockName = "air";
      let blockDistance = Infinity;
      try {
        const hit = bot.world.raycast(eye, direction, RAY_DISTANCE);
        blockName = hit?.name || "air";
        blockDistance = blockHitDistance(eye, hit);
      } catch {
        blockName = "air";
      }
      const playerHit = playerFigures.length
        ? nearestPlayerHit(eye, direction, playerFigures)
        : null;
      const playerIsNearer = playerHit && playerHit.distance < blockDistance;
      const isSky = blockName === "air" && !playerIsNearer;
      let [red, green, blue] = playerIsNearer
        ? playerHit.color
        : isSky
          ? sky
          : colorForBlockName(blockName);
      if (!isSky) {
        red *= brightness;
        green *= brightness;
        blue *= brightness;
      }
      // Diagonal streaks over every pixel in rain, the way rain crosses the
      // whole screen in the game, sky and ground alike.
      if (raining && (column * 3 + row * 2) % 17 === 0) {
        [red, green, blue] = RAIN_STREAK_COLOR;
      }
      const index = (row * width + column) * 4;
      pixels[index] = Math.round(red);
      pixels[index + 1] = Math.round(green);
      pixels[index + 2] = Math.round(blue);
      pixels[index + 3] = 255;
    }
  }

  const encoded = encodeJpeg({ data: pixels, width, height }, 80);
  return Buffer.from(encoded.data);
}

export async function captureFirstPersonScreenshot(bot) {
  if (typeof bot?.captureScreenshot === "function") {
    return bot.captureScreenshot();
  }
  // Each nearby player's skin colours, fetched once per skin address, so the
  // drawn player wears the player's own colours.
  const colorsByUsername = {};
  for (const entity of Object.values(bot?.entities || {})) {
    if (entity?.type !== "player" || !entity.username) continue;
    const skinUrl = bot.players?.[entity.username]?.skinData?.url;
    colorsByUsername[entity.username] = await skinColorsForUrl(skinUrl);
  }
  return renderFirstPersonJpeg(bot, {
    playerFigures: playerFiguresNear(bot, colorsByUsername),
  });
}
