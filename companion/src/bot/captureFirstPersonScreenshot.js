import { Vec3 } from "vec3";
import { encode as encodeJpeg } from "jpeg-js";

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

function lookDirection(yaw, pitch, offsetX, offsetY) {
  const lookYaw = yaw + offsetX;
  const lookPitch = pitch + offsetY;
  return new Vec3(
    -Math.sin(lookYaw) * Math.cos(lookPitch),
    -Math.sin(lookPitch),
    -Math.cos(lookYaw) * Math.cos(lookPitch)
  );
}

export function renderFirstPersonJpeg(bot, {
  width = IMAGE_WIDTH,
  height = IMAGE_HEIGHT,
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

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const offsetX = ((column / (width - 1) - 0.5) * fov * aspect);
      const offsetY = ((row / (height - 1) - 0.5) * fov);
      const direction = lookDirection(yaw, pitch, offsetX, offsetY).normalize();
      let blockName = "air";
      try {
        const hit = bot.world.raycast(eye, direction, RAY_DISTANCE);
        blockName = hit?.name || "air";
      } catch {
        blockName = "air";
      }
      const [red, green, blue] = colorForBlockName(blockName);
      const index = (row * width + column) * 4;
      pixels[index] = red;
      pixels[index + 1] = green;
      pixels[index + 2] = blue;
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
  return renderFirstPersonJpeg(bot);
}
