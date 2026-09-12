import { loadCompanionConfiguration } from "./configuration.js";
import {
  postAmbientLook,
  postIdlePlayTurn,
  postSpokenTurn,
  speakText,
  stopMessageTurn,
} from "./nexus/neuralNexusApi.js";
import { buildMinecraftPlayPrompt } from "./prompt/minecraftPlayPrompt.js";
import { buildWorldSnapshotText } from "./world/worldSnapshot.js";
import { parsePlayCommands } from "./actions/parsePlayCommands.js";
import { executePlayCommands } from "./actions/executePlayCommands.js";
import { createMinecraftBot } from "./bot/createMinecraftBot.js";
import { captureFirstPersonScreenshot } from "./bot/captureFirstPersonScreenshot.js";
import { playAvatarVoice } from "./bot/playAvatarVoice.js";

const configuration = loadCompanionConfiguration();
configuration.threadId = null;

const playAbort = { controller: null };
const bot = createMinecraftBot(configuration, {
  onUtterance: (utteranceBytes) => {
    handleSpokenUtterance(utteranceBytes).catch((error) => {
      console.error("Spoken turn failed:", error.message);
    });
  },
});

bot.on("login", () => {
  console.log(
    `Joined ${configuration.minecraftServerHost}:${configuration.minecraftServerPort} as ${configuration.minecraftUsername}`
  );
});

bot.on("error", (error) => {
  console.error("Minecraft bot error:", error.message);
});

bot.once("spawn", () => {
  setInterval(() => {
    sendAmbientLook().catch((error) => {
      console.warn("Ambient look failed:", error.message);
    });
  }, configuration.ambientCaptureIntervalSeconds * 1000);

  setInterval(() => {
    sendIdlePlayTurn().catch((error) => {
      console.warn("Idle play turn failed:", error.message);
    });
  }, configuration.idlePlayIntervalSeconds * 1000);
});

function playPrompt({ kidSpeechText = "", idleContinue = false } = {}) {
  return buildMinecraftPlayPrompt({
    worldSnapshotText: buildWorldSnapshotText(bot),
    kidSpeechText,
    idleContinue,
  });
}

async function interruptCurrentWork() {
  if (playAbort.controller) {
    playAbort.controller.abort();
  }
  playAbort.controller = new AbortController();
  if (configuration.lastRequestId) {
    await stopMessageTurn(configuration, {
      requestId: configuration.lastRequestId,
    }).catch(() => {});
  }
  return playAbort.controller.signal;
}

function rememberThread(turn) {
  if (turn.threadId) {
    configuration.threadId = turn.threadId;
  }
  if (turn.requestId) {
    configuration.lastRequestId = turn.requestId;
  }
}

async function handleReply(turn) {
  rememberThread(turn);
  const { spokenText, commands } = parsePlayCommands(turn.content || "");
  if (spokenText) {
    const spoken = await speakText(configuration, spokenText);
    if (spoken.audioBytes) {
      try {
        await playAvatarVoice(bot, spoken.audioBytes, configuration.voicePlayback);
      } catch (error) {
        console.warn("Voice playback failed:", error.message);
      }
    }
  }
  if (commands.length) {
    const results = await executePlayCommands(bot, commands, {
      abortSignal: playAbort.controller?.signal,
      onCommand: (command) => {
        console.log("Running", command.name, command.arguments);
      },
    });
    const failed = results.filter((result) => result.status === "failed");
    if (failed.length) {
      console.warn(
        "Skill failures:",
        failed.map((result) => `${result.command.name}: ${result.errorMessage}`).join("; ")
      );
    }
  }
}

async function handleSpokenUtterance(utteranceBytes) {
  const signal = await interruptCurrentWork();
  const turn = await postSpokenTurn(configuration, {
    playPromptMessage: playPrompt(),
    utteranceBytes,
    signal,
  });
  await handleReply(turn);
}

async function sendAmbientLook() {
  const screenshotBytes = await captureFirstPersonScreenshot(bot);
  if (!screenshotBytes) {
    return;
  }
  const turn = await postAmbientLook(configuration, { screenshotBytes });
  rememberThread(turn);
  if (turn.ambientDecision?.decision === "respond" && turn.content) {
    await handleReply(turn);
  }
}

async function sendIdlePlayTurn() {
  if (playAbort.controller && !playAbort.controller.signal.aborted) {
    return;
  }
  const signal = await interruptCurrentWork();
  const turn = await postIdlePlayTurn(configuration, {
    playPromptMessage: playPrompt({ idleContinue: true }),
    signal,
  });
  await handleReply(turn);
}
