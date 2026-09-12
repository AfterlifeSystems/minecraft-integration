import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited ${code}`));
      }
    });
  });
}

export async function playMpegOnHostSpeakers(audioBytes) {
  const directory = await mkdtemp(join(tmpdir(), "nexus-voice-"));
  const filePath = join(directory, "reply.mp3");
  await writeFile(filePath, audioBytes);

  const attempts = [
    ["ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", filePath]],
    ["powershell", ["-NoProfile", "-Command", `(New-Object System.Media.SoundPlayer '${filePath}').PlaySync()`]],
  ];
  let lastError;
  for (const [command, args] of attempts) {
    try {
      await runCommand(command, args);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No host audio player is available.");
}
