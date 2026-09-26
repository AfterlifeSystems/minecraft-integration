// A chat line that starts with "!" is a command for the body, typed the way a
// Mindcraft player types one: "!collectBlocks(oak_log, 10)", "!stop", or
// "!goToCoordinates 100 64 -20". The line runs on the body at once, never
// passes through Neural Nexus, and the result is posted in chat.

import { parseArgumentList } from "./parsePlayCommands.js";
import { allCommandRunners, resolveCommandName } from "../skills/skillLibrary.js";

const PARENTHESIZED_COMMAND_PATTERN = /^!\s*([A-Za-z_]+)\s*\(([\s\S]*)\)\s*$/;
const BARE_COMMAND_PATTERN = /^!\s*([A-Za-z_]+)(?:\s+([\s\S]*))?$/;

function wordsAsArguments(text) {
  const words = String(text || "").trim();
  if (!words) {
    return [];
  }
  // Quoted phrases stay one argument: !goal "build a small house".
  const parts = words.match(/"[^"]*"|'[^']*'|[^\s,]+/g) || [];
  return parts.map((part) => {
    const unquoted = part.replace(/^['"]|['"]$/g, "");
    return /^-?\d+(\.\d+)?$/.test(unquoted) ? Number(unquoted) : unquoted;
  });
}

// Returns { name, arguments, known } for a "!" line, or null for anything else.
export function parseTypedCommand(typedText) {
  const text = String(typedText || "").trim();
  if (!text.startsWith("!")) {
    return null;
  }
  const parenthesized = text.match(PARENTHESIZED_COMMAND_PATTERN);
  const bare = parenthesized ? null : text.match(BARE_COMMAND_PATTERN);
  const match = parenthesized || bare;
  if (!match) {
    return null;
  }
  const commandName = resolveCommandName(match[1]);
  const commandArguments = parenthesized ? parseArgumentList(match[2]) : wordsAsArguments(match[2]);
  return {
    name: commandName || match[1],
    arguments: commandArguments,
    known: Boolean(commandName) || match[1].toLowerCase() === "help",
  };
}

export function typedCommandHelpLines() {
  const names = Object.keys(allCommandRunners).map((name) => `!${name}`);
  const lines = [];
  let line = "Commands:";
  for (const name of names) {
    if (`${line} ${name}`.length > 230) {
      lines.push(line);
      line = "";
    }
    line = line ? `${line} ${name}` : name;
  }
  if (line) {
    lines.push(line);
  }
  lines.push('Type !name(arguments), for example !collectBlocks(oak_log, 10) or !goal "build a small house".');
  return lines;
}

// Who may type "!" commands. An empty list lets every player on the server do
// so, as Mindcraft does; DIRECT_COMMAND_PLAYERS narrows a public server to the
// named players.
export function playerMayTypeCommands(playerName, allowedPlayers) {
  if (!allowedPlayers || !allowedPlayers.length) {
    return true;
  }
  return allowedPlayers.some((allowed) => allowed.toLowerCase() === String(playerName || "").toLowerCase());
}
