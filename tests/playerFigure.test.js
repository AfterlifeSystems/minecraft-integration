import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { Vec3 } from "vec3";
import { decode } from "jpeg-js";
import {
  playerFiguresNear,
  renderFirstPersonJpeg,
} from "../companion/src/bot/captureFirstPersonScreenshot.js";
import {
  decodeSkinPng,
  skinColorsFromTexture,
} from "../companion/src/bot/playerSkinColors.js";

function pixelAt(jpegBytes, column, row) {
  const image = decode(jpegBytes, { useTArray: true });
  const index = (row * image.width + column) * 4;
  return [image.data[index], image.data[index + 1], image.data[index + 2]];
}

function botFacingPlayer(playerEquipment = []) {
  const playerEntity = {
    id: 2,
    type: "player",
    username: "EvanPlays",
    position: new Vec3(0, 64, -3),
    yaw: Math.PI,
    equipment: playerEquipment,
  };
  return {
    entity: { id: 1, position: new Vec3(0, 64, 0), eyeHeight: 1.62, yaw: 0, pitch: 0 },
    entities: { 1: { id: 1, type: "player" }, 2: playerEntity },
    world: { raycast: () => null },
  };
}

test("a player in front of the body is drawn in the player's skin colours", () => {
  const bot = botFacingPlayer();
  const torsoBlue = { head: [200, 150, 120], torso: [20, 40, 220], arms: [200, 150, 120], legs: [30, 30, 90] };
  const jpegBytes = renderFirstPersonJpeg(bot, {
    width: 64,
    height: 36,
    playerFigures: playerFiguresNear(bot, { EvanPlays: torsoBlue }),
  });
  // The centre ray at eye height 1.62 meets the head (1.5 to 2.0) of a player 3 blocks ahead.
  const [centreRed, , centreBlue] = pixelAt(jpegBytes, 32, 18);
  assert.ok(centreRed > 170 && centreBlue < 160, `centre ${centreRed},${centreBlue} should be the head`);
  // Below the centre, the torso is the skin's blue.
  const [, , torsoPixelBlue] = pixelAt(jpegBytes, 32, 24);
  assert.ok(torsoPixelBlue > 180, `torso blue ${torsoPixelBlue} should come from the skin`);
});

test("worn armor is drawn over the skin", () => {
  const bot = botFacingPlayer([null, null, null, null, { name: "golden_chestplate" }, null]);
  const jpegBytes = renderFirstPersonJpeg(bot, {
    width: 64,
    height: 36,
    playerFigures: playerFiguresNear(bot, {}),
  });
  const [red, green, blue] = pixelAt(jpegBytes, 32, 24);
  assert.ok(red > 220 && green > 180 && blue < 120, `chest ${red},${green},${blue} should be gold`);
});

function solidSkinPng(torsoColor) {
  const width = 64;
  const height = 64;
  const rows = [];
  for (let row = 0; row < height; row += 1) {
    const rowBytes = Buffer.alloc(1 + width * 4);
    for (let column = 0; column < width; column += 1) {
      const isTorsoFront = row >= 20 && row < 32 && column >= 20 && column < 28;
      const [red, green, blue] = isTorsoFront ? torsoColor : [10, 10, 10];
      rowBytes.set([red, green, blue, 255], 1 + column * 4);
    }
    rows.push(rowBytes);
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, Buffer.from(type, "ascii"), data, Buffer.alloc(4)]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test("the skin texture's front faces give the part colours", () => {
  const colors = skinColorsFromTexture(decodeSkinPng(solidSkinPng([200, 30, 40])));
  assert.deepEqual(colors.torso, [200, 30, 40]);
  assert.deepEqual(colors.head, [10, 10, 10]);
});

test("a file that is not a PNG decodes to nothing", () => {
  assert.equal(decodeSkinPng(Buffer.from("not a png")), null);
});
