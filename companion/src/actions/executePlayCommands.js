import { runSkill } from "../skills/skillLibrary.js";

export async function executePlayCommands(
  bot,
  commands,
  { abortSignal, onCommand } = {}
) {
  const results = [];
  for (const command of commands || []) {
    if (abortSignal?.aborted) {
      results.push({ command, status: "aborted" });
      break;
    }
    try {
      if (onCommand) {
        onCommand(command);
      }
      await runSkill(bot, command);
      results.push({ command, status: "ok" });
    } catch (error) {
      results.push({
        command,
        status: "failed",
        errorMessage: error.message,
      });
    }
  }
  return results;
}
