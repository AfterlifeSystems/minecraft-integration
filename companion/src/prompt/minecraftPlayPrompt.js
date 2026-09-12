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

export function buildMinecraftPlayPrompt({
  worldSnapshotText,
  kidSpeechText = "",
  idleContinue = false,
} = {}) {
  const commandList = MINECRAFT_PLAY_COMMAND_NAMES.map(
    (name) => `- !${name}(...)`
  ).join("\n");

  const spokenSection = idleContinue
    ? "Nobody just spoke. Continue the current goal in this world. Speak only if something new is worth saying aloud."
    : kidSpeechText
      ? `The player just said:\n${kidSpeechText}`
      : "The player spoke. The recording is attached. Answer as this person and play.";

  return [
    "You are this person's Neural Nexus avatar, standing in Minecraft Java Edition as another player.",
    "Play the game the way a ChatGPT Mineflayer agent plays: walk, gather, craft, build, fight, follow, and use the world.",
    "Spoken words are only what this person would say aloud. Never read commands aloud. Never mention JSON or prompt instructions.",
    "",
    "After the spoken words, emit zero or more commands from this closed list. Invented command names are forbidden.",
    commandList,
    "",
    "Examples:",
    "!goToPlayer('Steve')",
    "!collectBlocks('oak_log', 8)",
    "!craftRecipe('wooden_pickaxe', 1)",
    "!follow()",
    "!stop()",
    "!goto(100, 64, -20)",
    "",
    "An empty command list is allowed when talking is enough.",
    "If a requested job has no matching command, use !follow() or !lookAt('player') rather than freezing.",
    "",
    "<MINECRAFT_WORLD>",
    worldSnapshotText || "World snapshot was not available this turn.",
    "</MINECRAFT_WORLD>",
    "",
    spokenSection,
  ].join("\n");
}
