import { extractLocalBodyIntent } from "./extractLocalBodyIntent.js";
import { isPlayCommandHelpRequest } from "./formatCapabilityHelp.js";

export function extractAvatarMention(typedText, avatarUsername) {
  const text = String(typedText || "").trim();
  if (!text || !avatarUsername) {
    return null;
  }
  const escapedUsername = String(avatarUsername).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
  const mentionPatterns = [
    new RegExp(`^@${escapedUsername}\\b[:,]?\\s*`, "i"),
    new RegExp(`^${escapedUsername}\\b[:,]?\\s*`, "i"),
  ];
  for (const mentionPattern of mentionPatterns) {
    if (mentionPattern.test(text)) {
      return text.replace(mentionPattern, "").trim();
    }
  }
  return null;
}

export function extractDirectedPlayerText(typedText, avatarUsername) {
  const mentionedText = extractAvatarMention(typedText, avatarUsername);
  if (mentionedText !== null) {
    return mentionedText;
  }
  const text = String(typedText || "").trim();
  if (!text) {
    return null;
  }
  if (avatarUsername) {
    const escapedUsername = String(avatarUsername).replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
    const nameInLine = new RegExp(`@?${escapedUsername}\\b`, "i");
    if (nameInLine.test(text)) {
      const withoutName = text.replace(nameInLine, " ").replace(/\s+/g, " ").trim();
      return withoutName || text;
    }
  }
  if (extractLocalBodyIntent(text).length || isPlayCommandHelpRequest(text)) {
    return text;
  }
  return null;
}
