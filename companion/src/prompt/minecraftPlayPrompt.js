// Commands the avatar may send through act_in_minecraft. Kept identical to
// MINECRAFT_PLAY_COMMAND_NAMES in the Anubis act_in_minecraft tool. The
// player-only commands (!restart, !clearChat) and the queries (!stats,
// !inventory, ...) are typed in chat instead: a query's answer would have no
// way back to the model through a fire-and-forget minecraft_act frame.
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
  "giveCollected",
  "useOn",
  "attack",
  "sleep",
  "eat",
  "jump",
  "sneak",
  "say_chat",
  "stfu",
  "followPlayer",
  "goToCoordinates",
  "searchForBlock",
  "searchForEntity",
  "moveAway",
  "goToSurface",
  "digDown",
  "stay",
  "rememberHere",
  "goToRememberedPlace",
  "givePlayer",
  "consume",
  "discard",
  "putInChest",
  "takeFromChest",
  "viewChest",
  "smeltItem",
  "clearFurnace",
  "placeHere",
  "attackPlayer",
  "goToBed",
  "lookAtPlayer",
  "lookAtPosition",
  "showVillagerTrades",
  "tradeWithVillager",
  "goal",
  "endGoal",
  "setMode",
  "startConversation",
  "endConversation",
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
