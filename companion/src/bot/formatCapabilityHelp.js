function normalizeHelpText(typedText) {
  return String(typedText || "")
    .trim()
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[!?.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPlayCommandHelpRequest(typedText) {
  const normalized = normalizeHelpText(typedText);
  if (!normalized) {
    return false;
  }
  return (
    normalized === "help" ||
    normalized === "commands" ||
    normalized === "?" ||
    normalized === "what can you do" ||
    normalized === "what do you do" ||
    normalized === "what are you able to do" ||
    normalized === "what are your capabilities" ||
    normalized.includes("what can you do")
  );
}

export function formatCapabilityHelpLines(avatarUsername = "NeuralNexus") {
  const name = avatarUsername;
  return [
    `Talk to me the way you talk on Neural Nexus. Type @${name} and a sentence, whisper me, or say my name. I answer as this person in chat and with the cloned voice.`,
    `Hold push-to-talk to speak, not the V menu key. Say follow me, c'mon ${name}, come on, this way, over here, or keep up and I walk with you.`,
    `Say stay there, stay put, hold up, or stop following and I stop. Look at me and I face you. Name coordinates and I walk there.`,
    `Ask me to gather or mine nearby blocks, or to place something I am holding at x y z. I craft only on the 2 by 2 grid, like sticks and planks, not a crafting table.`,
    `I can smelt in a nearby furnace if I have fuel, hold or toss items, use a held item on someone, eat, and sleep in a nearby bed.`,
    `I can land one hit on a named mob. Jump and sneak are short gestures. I will not invent extra skills. I also look around on my own and may keep following or walk over if you are close.`,
    `Ask who I am or where I work the same way you would in Neural Nexus. That is a conversation, not a job for the body.`,
  ];
}
