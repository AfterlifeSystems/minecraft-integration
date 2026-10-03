import { test } from "node:test";
import assert from "node:assert/strict";
import { lookIntentOf, MINECRAFT_VIEW_FILE_NAME } from "../companion/src/bot/lookIntent.js";
import {
  buildTypedChatFormData,
  formDataEntries,
} from "../companion/src/nexus/messageFormData.js";

test("a question about how the person looks turns to the player before the picture", () => {
  for (const question of ["What do I look like?", "how do I look", "what am I wearing", "can you see me"]) {
    assert.equal(lookIntentOf(question), "look_at_player", question);
  }
});

test("other sight questions take the picture as the body faces", () => {
  for (const question of ["what do you see?", "What’s around us", "look around"]) {
    assert.equal(lookIntentOf(question), "view", question);
  }
});

test("play commands and talk take no picture", () => {
  for (const message of ["gather wood", "come here", "describe your plan", "hello"]) {
    assert.equal(lookIntentOf(message), "none", message);
  }
});

test("the view picture rides the typed request under the name Anubis recognises", () => {
  const formData = buildTypedChatFormData({
    playPromptMessage: "What do I look like?",
    viewPictureBytes: Buffer.from([0xff, 0xd8, 0xff]),
  });
  const fileEntries = formDataEntries(formData).filter((entry) => entry.name === "files");
  assert.equal(fileEntries.length, 1);
  assert.equal(fileEntries[0].fileName, MINECRAFT_VIEW_FILE_NAME);
  assert.equal(fileEntries[0].type, "image/jpeg");
  const withoutPicture = formDataEntries(buildTypedChatFormData({ playPromptMessage: "hi" }));
  assert.equal(withoutPicture.filter((entry) => entry.name === "files").length, 0);
});
