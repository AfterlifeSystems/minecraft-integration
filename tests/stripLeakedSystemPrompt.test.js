import { test } from "node:test";
import assert from "node:assert/strict";
import { stripLeakedSystemPrompt } from "../companion/src/bot/stripLeakedSystemPrompt.js";

test("drops latent Minecraft body text from a spoken reply", () => {
  const leaked =
    "I work on Neuralink.\n<LATENT_MINECRAFT_BODY>\nClosed command list: !follow()\n</LATENT_MINECRAFT_BODY>";
  assert.equal(stripLeakedSystemPrompt(leaked), "I work on Neuralink.");
});
