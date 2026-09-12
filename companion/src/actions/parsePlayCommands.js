import { MINECRAFT_PLAY_COMMAND_NAMES } from "../prompt/minecraftPlayPrompt.js";

const COMMAND_LINE_PATTERN = /!([A-Za-z_]+)\(([^)]*)\)/g;
const FENCED_ACTIONS_PATTERN =
  /```minecraft-actions\s*([\s\S]*?)```/i;

const JSON_NAME_TO_COMMAND = {
  goToPlayer: "goToPlayer",
  goto: "goto",
  follow: "follow",
  stop: "stop",
  lookAt: "lookAt",
  look_at: "lookAt",
  collectBlocks: "collectBlocks",
  mineBlock: "mineBlock",
  placeBlock: "placeBlock",
  craftRecipe: "craftRecipe",
  smelt: "smelt",
  equip: "equip",
  toss: "toss",
  give: "toss",
  useOn: "useOn",
  attack: "attack",
  sleep: "sleep",
  eat: "eat",
  jump: "jump",
  sneak: "sneak",
  say_chat: "say_chat",
  walk_to: "goto",
};

function parseArgumentList(source) {
  const trimmed = String(source || "").trim();
  if (!trimmed) {
    return [];
  }
  try {
    return JSON.parse(`[${trimmed.replace(/'/g, '"')}]`);
  } catch {
    return trimmed.split(",").map((part) => {
      const value = part.trim();
      if (/^-?\d+(\.\d+)?$/.test(value)) {
        return Number(value);
      }
      return value.replace(/^['"]|['"]$/g, "");
    });
  }
}

function allowedCommand(name) {
  return MINECRAFT_PLAY_COMMAND_NAMES.includes(name) ? name : null;
}

function commandsFromFence(sourceText) {
  const match = String(sourceText || "").match(FENCED_ACTIONS_PATTERN);
  if (!match) {
    return [];
  }
  try {
    const parsed = JSON.parse(match[1]);
    const actions = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.actions)
        ? parsed.actions
        : [];
    return actions
      .map((action) => {
        const mapped = JSON_NAME_TO_COMMAND[action.name];
        const commandName = allowedCommand(mapped);
        if (!commandName) {
          return null;
        }
        const argumentValues = [];
        if (action.target !== undefined) argumentValues.push(action.target);
        if (action.block !== undefined) argumentValues.push(action.block);
        if (action.count !== undefined) argumentValues.push(action.count);
        if (action.x !== undefined) argumentValues.push(action.x);
        if (action.y !== undefined) argumentValues.push(action.y);
        if (action.z !== undefined) argumentValues.push(action.z);
        if (Array.isArray(action.arguments)) {
          argumentValues.push(...action.arguments);
        }
        return { name: commandName, arguments: argumentValues };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function parsePlayCommands(replyText) {
  const source = String(replyText || "");
  const commands = [];
  for (const match of source.matchAll(COMMAND_LINE_PATTERN)) {
    const commandName = allowedCommand(match[1]);
    if (!commandName) {
      continue;
    }
    commands.push({
      name: commandName,
      arguments: parseArgumentList(match[2]),
    });
  }
  commands.push(...commandsFromFence(source));

  const spokenText = source
    .replace(FENCED_ACTIONS_PATTERN, "")
    .replace(COMMAND_LINE_PATTERN, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { spokenText, commands };
}
