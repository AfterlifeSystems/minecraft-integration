export function normalizeTypedChatMessage(rawMessage) {
  const text = String(rawMessage || "").trim();
  const prefixed = text.match(/^<([^>]+)>\s*([\s\S]*)$/);
  if (prefixed) {
    return {
      usernameHint: prefixed[1],
      typedText: prefixed[2].trim(),
    };
  }
  return { usernameHint: "", typedText: text };
}
