import { test } from "node:test";
import assert from "node:assert/strict";
import { Vec3 } from "vec3";
import {
  buildWorldSnapshotText,
  playerAppearanceText,
} from "../companion/src/world/worldSnapshot.js";

const evanPlayer = {
  id: 7,
  type: "player",
  username: "EvanPlays",
  position: new Vec3(3, 64, 4),
  equipment: [
    { name: "diamond_sword" },
    { name: "shield" },
    { name: "iron_boots" },
    null,
    { name: "iron_chestplate" },
    { name: "leather_helmet" },
  ],
};

test("the appearance names held items, worn armor, and the skin model", () => {
  const bot = {
    players: {
      EvanPlays: {
        skinData: { url: "http://textures.minecraft.net/texture/abc", model: "slim" },
      },
    },
  };
  assert.equal(
    playerAppearanceText(bot, evanPlayer),
    "holding diamond_sword; off hand shield; wearing head leather_helmet, chest iron_chestplate, feet iron_boots; custom skin, slim arms"
  );
});

test("a player with no equipment and no skin data is described plainly", () => {
  assert.equal(
    playerAppearanceText({ players: {} }, { username: "Steve", equipment: [] }),
    "holding nothing; wearing no armor; skin unknown (default Steve or Alex skin, or not reported)"
  );
});

test("the world snapshot carries the appearance on the nearby player line", () => {
  const bot = {
    entity: { id: 1, position: new Vec3(0, 64, 0) },
    entities: { 1: { id: 1, type: "player" }, 7: evanPlayer },
    players: {},
    blockAt: () => ({ name: "grass_block" }),
  };
  const snapshot = buildWorldSnapshotText(bot);
  assert.match(snapshot, /EvanPlays distance=5\.0 at .* appearance: holding diamond_sword/);
});
