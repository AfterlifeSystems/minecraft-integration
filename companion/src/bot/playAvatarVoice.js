import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { playMpegOnHostSpeakers } from "./voicePlayback.js";

export async function playAvatarVoice(bot, audioBytes, voicePlayback) {
  if (!audioBytes || voicePlayback === "off") {
    return;
  }
  if (bot?.voicechat?.sendAudio) {
    const directory = await mkdtemp(join(tmpdir(), "nexus-svc-"));
    const filePath = join(directory, "reply.mp3");
    await writeFile(filePath, audioBytes);
    await bot.voicechat.sendAudio(filePath);
    return;
  }
  await playMpegOnHostSpeakers(audioBytes);
}
