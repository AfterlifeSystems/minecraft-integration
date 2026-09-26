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
