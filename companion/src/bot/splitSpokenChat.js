const MAXIMUM_MINECRAFT_CHAT_LENGTH = 240;

export function splitSpokenSentences(spokenText) {
  const text = String(spokenText || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return [];
  }
  const parts = text.match(/[^.!?…]+(?:[.!?…]+|$)/g);
  return (parts || [text]).map((part) => part.trim()).filter(Boolean);
}

export function wrapSpokenChatLines(
  spokenText,
  maximumLineLength = MAXIMUM_MINECRAFT_CHAT_LENGTH
) {
  const text = String(spokenText || "").trim();
  if (!text) {
    return [];
  }
  if (text.length <= maximumLineLength) {
    return [text];
  }
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";
  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maximumLineLength) {
      currentLine = nextLine;
      continue;
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    currentLine =
      word.length <= maximumLineLength
        ? word
        : word.slice(0, maximumLineLength);
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}
