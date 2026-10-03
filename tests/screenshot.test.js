import { test } from "node:test";
import assert from "node:assert/strict";
import { Vec3 } from "vec3";
import { renderFirstPersonJpeg } from "../companion/src/bot/captureFirstPersonScreenshot.js";

test("first-person capture writes a JPEG of the blocks in front of the bot", () => {
  const bot = {
    entity: {
      position: new Vec3(0, 64, 0),
      eyeHeight: 1.62,
      yaw: 0,
      pitch: 0,
    },
    world: {
      raycast() {
        return { name: "oak_log" };
      },
    },
  };
  const jpeg = renderFirstPersonJpeg(bot, { width: 16, height: 9 });
  assert.equal(jpeg[0], 0xff);
  assert.equal(jpeg[1], 0xd8);
  assert.ok(jpeg.length > 100);
});

test("first-person capture returns null before spawn", () => {
  assert.equal(renderFirstPersonJpeg({}), null);
});

test("the drawn view and the snapshot show rain and night", async () => {
  const { viewConditions } = await import("../companion/src/bot/captureFirstPersonScreenshot.js");
  const { weatherText, timeOfDayText } = await import("../companion/src/world/worldSnapshot.js");
  const clearNoon = viewConditions({ isRaining: false, time: { timeOfDay: 6000 } });
  const rainyNoon = viewConditions({ isRaining: true, thunderState: 0, time: { timeOfDay: 6000 } });
  const night = viewConditions({ isRaining: false, time: { timeOfDay: 18000 } });
  assert.deepEqual(clearNoon.sky, [135, 206, 235]);
  assert.notDeepEqual(rainyNoon.sky, clearNoon.sky);
  assert.equal(rainyNoon.raining, true);
  assert.ok(night.brightness < 0.5);
  assert.equal(weatherText({ isRaining: true, thunderState: 0 }), "raining (snowing in cold biomes)");
  assert.equal(weatherText({ isRaining: true, thunderState: 1 }), "thunderstorm");
  assert.equal(weatherText({ isRaining: false }), "clear");
  assert.equal(timeOfDayText({ time: { timeOfDay: 18000 } }), "night");
});

// Reported 2026-10-02: the avatar said "a brown tree on the left" while the
// player saw a brown dirt column on the right. Mineflayer's view direction is
// (-sin(yaw) cos(pitch), sin(pitch), -cos(yaw) cos(pitch)), so facing north
// (yaw 0, toward -Z) the body's right is +X and looking up is a positive pitch.
async function averageRedOfColumns(jpegBytes, firstColumn, lastColumn) {
  const { decode } = await import("jpeg-js");
  const image = decode(jpegBytes, { useTArray: true });
  let redTotal = 0;
  let pixelCount = 0;
  for (let row = 0; row < image.height; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      redTotal += image.data[(row * image.width + column) * 4];
      pixelCount += 1;
    }
  }
  return redTotal / pixelCount;
}

async function averageRedOfRows(jpegBytes, firstRow, lastRow) {
  const { decode } = await import("jpeg-js");
  const image = decode(jpegBytes, { useTArray: true });
  let redTotal = 0;
  let pixelCount = 0;
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = 0; column < image.width; column += 1) {
      redTotal += image.data[(row * image.width + column) * 4];
      pixelCount += 1;
    }
  }
  return redTotal / pixelCount;
}

function botFacingNorth({ pitch = 0, blockWhere }) {
  return {
    entity: { position: new Vec3(0, 64, 0), eyeHeight: 1.62, yaw: 0, pitch },
    world: {
      raycast(_eye, direction) {
        // lava is drawn red (220), sky blue (135); red separates the two.
        return blockWhere(direction) ? { name: "lava" } : null;
      },
    },
  };
}

test("a block on the body's right is drawn on the right of the view", async () => {
  const bot = botFacingNorth({ blockWhere: (direction) => direction.x > 0 });
  const jpegBytes = renderFirstPersonJpeg(bot, { width: 32, height: 18 });
  const leftRed = await averageRedOfColumns(jpegBytes, 0, 7);
  const rightRed = await averageRedOfColumns(jpegBytes, 24, 31);
  assert.ok(rightRed > leftRed + 50, `right ${rightRed} should be redder than left ${leftRed}`);
});

test("a body looking up draws what is above at the top and centre of the view", async () => {
  const bot = botFacingNorth({ pitch: 0.3, blockWhere: (direction) => direction.y > 0 });
  const jpegBytes = renderFirstPersonJpeg(bot, { width: 32, height: 18 });
  const topRed = await averageRedOfRows(jpegBytes, 0, 3);
  const bottomRed = await averageRedOfRows(jpegBytes, 14, 17);
  assert.ok(topRed > bottomRed + 50, `top ${topRed} should be redder than bottom ${bottomRed}`);
  // pitch 0.3 > 0 means the centre ray points up, as mineflayer's own ray does.
  const centreRed = await averageRedOfRows(jpegBytes, 8, 9);
  assert.ok(centreRed > 180, `centre ${centreRed} should show the block above`);
});
