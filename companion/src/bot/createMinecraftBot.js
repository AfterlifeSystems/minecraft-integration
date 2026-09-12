import mineflayer from "mineflayer";
import pathfinderPackage from "mineflayer-pathfinder";

const { pathfinder, Movements } = pathfinderPackage;
import { pcmS16leToWavBytes } from "./pcmWav.js";

export function createMinecraftBot(configuration, { onUtterance } = {}) {
  const bot = mineflayer.createBot({
    host: configuration.minecraftServerHost,
    port: configuration.minecraftServerPort,
    username: configuration.minecraftUsername,
    auth: configuration.minecraftAuth,
    version: "1.21.1",
  });

  bot.loadPlugin(pathfinder);

  bot.once("spawn", () => {
    const movements = new Movements(bot);
    bot.pathfinder.setMovements(movements);
  });

  attachSimpleVoiceChat(bot, onUtterance).catch((error) => {
    console.warn("Simple Voice Chat plugin was not loaded:", error.message);
  });

  return bot;
}

async function attachSimpleVoiceChat(bot, onUtterance) {
  const simpleVoice = await import("mineflayer-simplevoice");
  const plugin = simpleVoice.plugin || simpleVoice.default?.plugin;
  if (!plugin) {
    throw new Error("mineflayer-simplevoice has no plugin export.");
  }
  bot.loadPlugin(plugin);

  const chunks = [];
  let silenceTimer;
  const flush = () => {
    if (!chunks.length || !onUtterance) {
      return;
    }
    const pcm = Buffer.concat(chunks);
    chunks.length = 0;
    onUtterance(pcmS16leToWavBytes(pcm));
  };

  bot.on("voicechat_player_sound", (event) => {
    if (event?.data) {
      chunks.push(Buffer.from(event.data));
    }
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(flush, 800);
  });
}
