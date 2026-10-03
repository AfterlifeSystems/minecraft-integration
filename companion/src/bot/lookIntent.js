// Which player messages need the body's view, decided in the companion so the
// picture can ride the first request. A picture sent up front saves the
// look_now pause and the second model call; for a question about how the
// person looks, the body also turns to the person first, so the picture shows
// the person's player character.
//
// The phrases follow _MINECRAFT_SIGHT_MARKERS in the Anubis look tools
// (src/anubis/utils/tools/vision/look_tools.py), without the bare word
// "describe": "describe your plan" would pay for a picture description it
// does not need, and the server's look_now still covers a missed phrase.
const APPEARANCE_PATTERNS = [
  /\bwhat do i look like\b/i,
  /\bhow do i look\b/i,
  /\bwhat am i wearing\b/i,
  /\bwhat am i holding\b/i,
  /\b(can|do) you see me\b/i,
  /\bdescribe me\b/i,
];

const SIGHT_PATTERNS = [
  /\bwhat do you see\b/i,
  /\bwhat can you see\b/i,
  /\bwhat(?:'|’)?s around\b/i,
  /\bwhat is around\b/i,
  /\blook around\b/i,
  /\blook now\b/i,
  /\bscreenshot\b/i,
];

export function isAppearanceQuestion(text) {
  const playerText = String(text || "");
  return APPEARANCE_PATTERNS.some((pattern) => pattern.test(playerText));
}

// "look_at_player" for a question about the person's own character (turn to
// the person, then take the picture), "view" for any other sight question
// (take the picture as the body faces), "none" otherwise.
export function lookIntentOf(text) {
  if (isAppearanceQuestion(text)) {
    return "look_at_player";
  }
  const playerText = String(text || "");
  return SIGHT_PATTERNS.some((pattern) => pattern.test(playerText)) ? "view" : "none";
}

// The file name Anubis recognises as the body's first-person view picture
// (MINECRAFT_VIEW_FILE_NAME in src/anubis/utils/tools/minecraft/minecraft_body_tools.py).
export const MINECRAFT_VIEW_FILE_NAME = "minecraft_view.jpg";
