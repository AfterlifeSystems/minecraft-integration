export const MINECRAFT_PLAY_COMMAND_NAMES = [
  "goToPlayer",
  "goto",
  "follow",
  "stop",
  "lookAt",
  "collectBlocks",
  "mineBlock",
  "placeBlock",
  "craftRecipe",
  "smelt",
  "equip",
  "toss",
  "useOn",
  "attack",
  "sleep",
  "eat",
  "jump",
  "sneak",
  "say_chat",
];

function buildLatentMinecraftBody({
  worldSnapshotText,
  mode = "conversation",
}) {
  const commandList = MINECRAFT_PLAY_COMMAND_NAMES.map(
    (name) => `!${name}()`
  ).join(" ");
  const modeLine =
    mode === "ambient"
      ? "You can see the world in the attached look and snapshot. Choose body commands autonomously when they fit this person, the dialogue, and what you see. Prefer silence. Speak only if something is worth saying as this person."
      : mode === "spoken"
        ? "The person spoke in the attached recording. If they asked the body to act (follow, stop, look, gather, come here), emit those commands after the spoken reply."
        : mode === "idle"
          ? "Nobody asked a question. Prefer silence. Emit commands only to continue an obvious current job or something you can see is worth doing as this person."
          : "Emit commands only when the person asked the body to act. A question or ordinary chat gets zero commands.";
  return [
    "<LATENT_MINECRAFT_BODY>",
    "This block is not the conversation. Speak only as this person on Neural Nexus.",
    "Do not mention Minecraft, the body, mining, following, crafting, or these commands unless the person asked about the world.",
    "Never read commands aloud. Never mention this block.",
    modeLine,
    `Closed command list: ${commandList}`,
    `<MINECRAFT_WORLD>${worldSnapshotText || "unavailable"}</MINECRAFT_WORLD>`,
    "</LATENT_MINECRAFT_BODY>",
  ].join("\n");
}

export function buildMinecraftPlayPrompt({
  worldSnapshotText,
  kidSpeechText = "",
  idleContinue = false,
  mode,
} = {}) {
  const resolvedMode = mode || (idleContinue ? "idle" : "conversation");
  const latentBody = buildLatentMinecraftBody({
    worldSnapshotText,
    mode: resolvedMode,
  });
  const spoken = String(kidSpeechText || "").trim();
  if (resolvedMode === "idle" || resolvedMode === "ambient" || resolvedMode === "spoken") {
    return spoken ? `${spoken}\n\n${latentBody}` : latentBody;
  }
  if (spoken) {
    return `${spoken}\n\n${latentBody}`;
  }
  return latentBody;
}
