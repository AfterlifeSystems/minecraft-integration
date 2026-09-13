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

export function extractLocalBodyIntent(typedText) {
  const normalized = normalizeBodyText(typedText);
  if (!normalized) {
    return [];
  }
  if (
    /\b(stop following|stay there|stay here|stay put|wait there|hold up|hold still|don't follow|do not follow|halt)\b/.test(
      normalized
    ) ||
    normalized === "stop" ||
    normalized === "stay" ||
    normalized === "wait"
  ) {
    return [{ name: "stop", arguments: [] }];
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
  if (/\blook at me\b/.test(normalized) || normalized === "look here") {
    return [{ name: "lookAt", arguments: ["player"] }];
  }
  return [];
}
