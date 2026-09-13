const LEAKED_PROMPT_PATTERNS = [
  /<LATENT_MINECRAFT_BODY>[\s\S]*?<\/LATENT_MINECRAFT_BODY>/gi,
  /<MINECRAFT_WORLD>[\s\S]*?<\/MINECRAFT_WORLD>/gi,
  /Closed command list:[^\n]*/gi,
  /This block is not the conversation[^\n]*/gi,
  /Speak only as this person on Neural Nexus[^\n]*/gi,
  /Do not mention Minecraft[^\n]*/gi,
  /Never read commands aloud[^\n]*/gi,
  /Emit commands only[^\n]*/gi,
  /You can see the world in the attached look[^\n]*/gi,
  /The person spoke in the attached recording[^\n]*/gi,
  /!([A-Za-z_]+)\([^)]*\)/g,
];

export function stripLeakedSystemPrompt(text) {
  let cleaned = String(text || "");
  for (const pattern of LEAKED_PROMPT_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  return cleaned.replace(/\s+/g, " ").trim();
}
