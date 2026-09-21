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

/**
 * The conversation partner's words, unchanged.
 * The play contract lives on act_in_minecraft in the graph, not in this text.
 */
export function buildMinecraftPlayPrompt({
  kidSpeechText = "",
} = {}) {
  return String(kidSpeechText || "").trim();
}
