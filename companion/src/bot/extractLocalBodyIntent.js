function normalizeBodyText(typedText) {
  return String(typedText || "")
    .trim()
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[!?.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A command is the imperative at the start of the line, optionally behind a
// polite opener ("please dig", "can you gather wood", "go chop some trees").
// Anchoring at the start keeps a question such as "did you get wood
// yesterday?" from moving the body.
const POLITE_OPENER =
  "(?:(?:please|pls|now|ok|okay|hey|go|can you|could you|would you|will you)\\s+)*";
const FILLER_WORDS = "(?:\\s+(?:some|more|the|a|down|up|us|me|for))*";
const WOOD_WORDS = "(?:woods?|logs?|trees?|timber)";

// "wood" is a block family rather than one block name: collectBlocks resolves
// "log" to whichever *_log block is nearest, so a dark oak forest is gathered
// without first looking at the screen to learn which tree is standing there.
export const WOOD_BLOCK_FAMILY = "log";
export const GATHER_WOOD_COUNT = 8;
export const DIG_BLOCK_COUNT = 4;
export const DEFAULT_DIG_BLOCK = "dirt";

// "gather" and "chop" alone mean wood; "get" and "grab" need the wood named,
// or every "get" in chat would send the body to the trees.
const GATHER_WOOD_PATTERN = new RegExp(
  "^" +
    POLITE_OPENER +
    "(?:gather|collect|chop|harvest|punch)" +
    FILLER_WORDS +
    "(?:\\s+" +
    WOOD_WORDS +
    ")?$"
);
const GET_WOOD_PATTERN = new RegExp(
  "^" + POLITE_OPENER + "(?:get|grab|cut|fetch)" + FILLER_WORDS + "\\s+" + WOOD_WORDS + "$"
);
// "GatherWoods" typed as one word.
const JOINED_GATHER_WOOD_PATTERN = /^(?:gather|collect|chop|get)(?:woods?|logs?|trees?)$/;

// Words a person uses for a block, mapped to the Minecraft block name the
// collectBlocks skill looks for.
const DIG_BLOCK_WORDS = {
  dirt: "dirt",
  ground: "dirt",
  grass: "grass_block",
  stone: "stone",
  rock: "stone",
  rocks: "stone",
  cobble: "stone",
  cobblestone: "stone",
  sand: "sand",
  gravel: "gravel",
  clay: "clay",
  coal: "coal_ore",
  iron: "iron_ore",
  copper: "copper_ore",
  gold: "gold_ore",
  diamond: "diamond_ore",
  diamonds: "diamond_ore",
};

const DIG_PATTERN = new RegExp(
  "^" +
    POLITE_OPENER +
    "(?:dig|mine)(?:\\s+(?:some|more|the|a|up|down|for|out))*(?:\\s+([a-z_]+))?(?:\\s+(?:blocks?|ore))?$"
);

const STOP_PATTERN =
  /\b(stop follow\w*|stay there|stay here|stay put|wait there|wait here|hold up|hold still|hold on|stand still|don't move|do not move|don't follow|do not follow|dont follow|halt)\b/;
const SHORT_STOP_PATTERN =
  /^(?:please\s+|ok\s+|okay\s+)?(?:stop|stay|wait|freeze)(?:\s+\S+){0,2}$/;

// "give me what you collected" must walk over and drop the inventory; listing
// the inventory or only walking to the player leaves the items in the body's
// hands. Anchored so "give me a joke" stays a conversation.
const GIVE_COLLECTED_PATTERN = new RegExp(
  "^" +
    POLITE_OPENER +
    "(?:give|hand|toss|drop|pass)" +
    FILLER_WORDS +
    "(?:\\s+(?:over|back))?" +
    FILLER_WORDS +
    "\\s+(?:" +
    "what you (?:collected|gathered|got|have|picked up)|" +
    "(?:all|everything)(?:\\s+you\\s+(?:collected|gathered|got|have|picked up))?|" +
    "(?:your\\s+)?(?:stuff|inventory|items|loot|drops)" +
    ")$"
);

export function extractLocalBodyIntent(typedText) {
  const normalized = normalizeBodyText(typedText);
  if (!normalized) {
    return [];
  }
  if (STOP_PATTERN.test(normalized)) {
    return [{ name: "stop", arguments: [] }];
  }
  if (GIVE_COLLECTED_PATTERN.test(normalized)) {
    return [{ name: "giveCollected", arguments: ["player"] }];
  }
  if (
    /\bfollow\b/.test(normalized) ||
    /\bc'?mon\b/.test(normalized) ||
    /\bcome on\b/.test(normalized) ||
    /\bcome with me\b/.test(normalized) ||
    /\bcome here\b/.test(normalized) ||
    /\bcome over\b/.test(normalized) ||
    /\bwalk with me\b/.test(normalized) ||
    /\bthis way\b/.test(normalized) ||
    /\bover here\b/.test(normalized) ||
    /\bkeep up\b/.test(normalized) ||
    /\bwith me\b/.test(normalized)
  ) {
    return [{ name: "follow", arguments: [] }];
  }
  // Checked after the follow phrases so "stay with me" still follows.
  if (SHORT_STOP_PATTERN.test(normalized)) {
    return [{ name: "stop", arguments: [] }];
  }
  if (/\blook at me\b/.test(normalized) || normalized === "look here") {
    return [{ name: "lookAt", arguments: ["player"] }];
  }
  if (
    GATHER_WOOD_PATTERN.test(normalized) ||
    GET_WOOD_PATTERN.test(normalized) ||
    JOINED_GATHER_WOOD_PATTERN.test(normalized.replace(/\s+/g, ""))
  ) {
    return [
      { name: "collectBlocks", arguments: [WOOD_BLOCK_FAMILY, GATHER_WOOD_COUNT] },
    ];
  }
  const digMatch = normalized.match(DIG_PATTERN);
  if (digMatch) {
    const blockWord = digMatch[1];
    if (blockWord && !DIG_BLOCK_WORDS[blockWord]) {
      // A block the fast path does not know ("dig a tunnel", "mine netherite")
      // is left to Neural Nexus, which reads the world snapshot.
      return [];
    }
    const blockName = blockWord ? DIG_BLOCK_WORDS[blockWord] : DEFAULT_DIG_BLOCK;
    return [{ name: "collectBlocks", arguments: [blockName, DIG_BLOCK_COUNT] }];
  }
  return [];
}

// Commands that leave the body holding still until the player asks for
// movement again. Ambient autonomy must not walk the body anywhere while held.
export function commandHoldsTheBody(command) {
  return ["stop", "stay"].includes(command?.name);
}

// Commands that give the body a new goal and so end a hold.
export function commandReleasesTheBody(command) {
  return [
    "follow",
    "followPlayer",
    "goToPlayer",
    "goto",
    "goToCoordinates",
    "goToRememberedPlace",
    "searchForBlock",
    "searchForEntity",
    "giveCollected",
  ].includes(command?.name);
}
