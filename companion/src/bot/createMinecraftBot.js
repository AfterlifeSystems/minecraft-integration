import mineflayer from "mineflayer";
import pathfinderPackage from "mineflayer-pathfinder";

const { pathfinder, Movements } = pathfinderPackage;
import { pcmS16leToWavBytes } from "./pcmWav.js";
import { configureSimpleVoiceChatClient } from "./configureSimpleVoiceChatClient.js";
import { firstOtherPlayer } from "../world/worldSnapshot.js";
import {
  MAXIMUM_UTTERANCE_PCM_BYTES,
  VOICE_SAMPLE_RATE,
  isCompanionOwnVoiceEvent,
  isOtherPlayerVoiceEvent,
  pcmMeetsSpeechThreshold,
} from "./voiceUtteranceFilter.js";

export function createMinecraftBot(
  configuration,
  { onUtterance, shouldCollectVoice } = {}
) {
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

  attachSimpleVoiceChat(bot, configuration, {
    onUtterance,
    shouldCollectVoice,
  }).catch((error) => {
    console.warn("Simple Voice Chat plugin was not loaded:", error.message);
  });

  return bot;
}

async function attachSimpleVoiceChat(
  bot,
  configuration,
  { onUtterance, shouldCollectVoice } = {}
) {
  const simpleVoice = await import("mineflayer-simplevoice");
  const plugin = simpleVoice.plugin || simpleVoice.default?.plugin;
  if (!plugin) {
    throw new Error("mineflayer-simplevoice has no plugin export.");
  }
  bot.loadPlugin(plugin);
  const applyVoiceRedirect = () => {
    configureSimpleVoiceChatClient(bot, {
      udpHost: configuration.minecraftServerHost,
    });
  };
  if (bot.voicechat?._client) {
    applyVoiceRedirect();
  } else {
    bot.once("inject_allowed", applyVoiceRedirect);
  }
  bot.on("voicechat_connect", () => {
    console.log("Simple Voice Chat connected");
  });

  const chunks = [];
  let silenceTimer;
  let bufferedSenderName = "";
  let lastUnnamedVoiceLogMs = 0;
  const discardBufferedVoice = () => {
    chunks.length = 0;
    bufferedSenderName = "";
    clearTimeout(silenceTimer);
  };
  const flush = () => {
    if (!chunks.length || !onUtterance) {
      discardBufferedVoice();
      return;
    }
    const pcm = Buffer.concat(chunks);
    const senderName = bufferedSenderName;
    discardBufferedVoice();
    const speech = pcmMeetsSpeechThreshold(pcm);
    if (!speech.accepted) {
      console.log(
        `Ignoring quiet voice from ${senderName || "unknown"} (rms ${Math.round(speech.rms)}, peak ${speech.peak}, ${speech.durationSeconds.toFixed(2)}s)`
      );
      return;
    }
    onUtterance(pcmS16leToWavBytes(pcm, VOICE_SAMPLE_RATE), senderName);
  };

  bot.discardBufferedVoice = discardBufferedVoice;

  function resolveVoiceSenderName(event) {
    if (isCompanionOwnVoiceEvent(event, configuration.minecraftUsername)) {
      return "";
    }
    if (isOtherPlayerVoiceEvent(event, configuration.minecraftUsername)) {
      return String(event.sender);
    }
    const nearby = firstOtherPlayer(bot);
    return nearby?.username || "";
  }

  bot.on("voicechat_player_sound", (event) => {
    const senderName = resolveVoiceSenderName(event);
    if (!senderName) {
      const now = Date.now();
      if (now - lastUnnamedVoiceLogMs > 2000) {
        lastUnnamedVoiceLogMs = now;
        console.log("Voice packet ignored (no player name on the packet)");
      }
      return;
    }
    if (typeof shouldCollectVoice === "function" && !shouldCollectVoice(event)) {
      discardBufferedVoice();
      return;
    }
    if (event?.data) {
      if (!chunks.length) {
        console.log("Voice started from", senderName);
      }
      const currentBytes = chunks.reduce((total, chunk) => total + chunk.length, 0);
      if (currentBytes + event.data.length > MAXIMUM_UTTERANCE_PCM_BYTES) {
        flush();
        return;
      }
      chunks.push(Buffer.from(event.data));
      bufferedSenderName = senderName;
    }
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(flush, 800);
  });
}
