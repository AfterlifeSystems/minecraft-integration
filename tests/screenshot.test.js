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
