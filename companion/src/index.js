import { installFlushingConsole } from "./bot/flushingConsole.js";
import {
  assistantIdFingerprint,
  loadCompanionConfiguration,
} from "./configuration.js";
import {
  isLookNowInterrupt,
  postAmbientLook,
  postLookNowResume,
  postSpokenTurn,
  postTypedChatTurn,
  speakText,
  stopMessageTurn,
} from "./nexus/neuralNexusApi.js";
import { firstOtherPlayer } from "./world/worldSnapshot.js";
import { parsePlayCommands } from "./actions/parsePlayCommands.js";
import { executePlayCommands } from "./actions/executePlayCommands.js";
import { createMinecraftBot } from "./bot/createMinecraftBot.js";
import { captureFirstPersonScreenshot } from "./bot/captureFirstPersonScreenshot.js";
import { playAvatarVoice } from "./bot/playAvatarVoice.js";
import { normalizeTypedChatMessage } from "./bot/normalizeTypedChatMessage.js";
import { extractDirectedPlayerText } from "./bot/extractAvatarMention.js";
import {
  formatCapabilityHelpLines,
  isPlayCommandHelpRequest,
} from "./bot/formatCapabilityHelp.js";
import {
  isAbortError,
  rememberTurnStartedFrame,
} from "./bot/voiceUtteranceFilter.js";
import {
  companionIsBusyWithUserTurn,
  enqueueUserTurn,
} from "./bot/userTurnQueue.js";
import { extractLocalBodyIntent } from "./bot/extractLocalBodyIntent.js";
import { wrapSpokenChatLines } from "./bot/splitSpokenChat.js";
import { stripLeakedSystemPrompt } from "./bot/stripLeakedSystemPrompt.js";

installFlushingConsole();

const configuration = loadCompanionConfiguration();
configuration.threadId = null;

const playAbort = { controller: null };
let activeUserTurnKind = null;
let ignoreVoiceUntilMs = 0;
let userTurnQueue = [];
let drainingTurns = false;
const MAXIMUM_LOOKS_PER_TURN = 2;
const MINIMUM_SPOKEN_UTTERANCE_BYTES = 12000;
const VOICE_QUIET_AFTER_PLAYBACK_MS = 4000;
let bot;
let ambientTimer = null;
let idleTimer = null;
let reconnectTimer = null;
let lastBodyGoalName = null;
let ambientLookInFlight = false;
let ambientAbortController = null;

function startMinecraftCompanion() {
  bot = createMinecraftBot(configuration, {
    onUtterance: (utteranceBytes, senderName) => {
      handleSpokenUtterance(utteranceBytes, senderName);
    },
    shouldCollectVoice: () => Date.now() >= ignoreVoiceUntilMs,
  });

  bot.on("login", () => {
    console.log(
      `Joined ${configuration.minecraftServerHost}:${configuration.minecraftServerPort} as ${configuration.minecraftUsername}`
    );
    console.log(
      `Neural Nexus avatar ${assistantIdFingerprint(configuration.assistantId)}`
    );
    console.log(
      "Chat: @NeuralNexus …, c'mon NeuralNexus, or stay there. Follow logs: docker compose logs -f companion"
    );
  });

  bot.on("messagestr", (message, messagePosition, _jsonMessage, senderUuid) => {
    if (messagePosition !== "chat") {
      return;
    }
    handlePlayerChat(resolveChatUsername(senderUuid), message).catch((error) => {
      console.error("Typed chat turn failed:", error.message);
    });
  });

  bot.on("whisper", (username, message) => {
    const mentionLine = `@${configuration.minecraftUsername} ${message}`;
    handlePlayerChat(username, mentionLine).catch((error) => {
      console.error("Typed whisper turn failed:", error.message);
    });
  });

  bot.on("error", (error) => {
    const message = String(error?.message || error);
    if (error?.name === "PartialReadError" || message.includes("PartialReadError") || message.includes("Read error for undefined")) {
      console.warn("Minecraft packet parse skipped (1.21 slot data). Voice and chat keep running.");
      return;
    }
    console.error("Minecraft bot error:", message);
  });

  bot.once("spawn", () => {
    if (ambientTimer) {
      clearInterval(ambientTimer);
    }
    if (idleTimer) {
      clearInterval(idleTimer);
    }
    ambientTimer = setInterval(() => {
      sendAmbientLook().catch((error) => {
        console.warn("Ambient look failed:", error.message);
      });
    }, configuration.ambientCaptureIntervalSeconds * 1000);

    idleTimer = setInterval(() => {
      sendIdlePlayTurn().catch((error) => {
        console.warn("Idle play turn failed:", error.message);
      });
    }, configuration.idlePlayIntervalSeconds * 1000);
  });

  bot.on("end", () => {
    console.warn("Disconnected from Minecraft; reconnecting in 5 seconds.");
    if (ambientTimer) {
      clearInterval(ambientTimer);
      ambientTimer = null;
    }
    if (idleTimer) {
      clearInterval(idleTimer);
      idleTimer = null;
    }
    if (reconnectTimer) {
      return;
    }
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      startMinecraftCompanion();
    }, 5000);
  });
}

startMinecraftCompanion();

function conversationMessage(kidSpeechText = "") {
  return String(kidSpeechText || "").trim();
}

function playerTurnIsInFlight() {
  return companionIsBusyWithUserTurn({
    drainingTurns,
    queuedCount: userTurnQueue.length,
    activeUserTurnKind,
  });
}

function neuralNexusIsBusy() {
  return playerTurnIsInFlight() || ambientLookInFlight;
}

async function preemptAmbientLook() {
  if (!ambientLookInFlight) {
    return;
  }
  console.log("Stopping ambient look for a player turn");
  if (configuration.lastRequestId) {
    await stopMessageTurn(configuration, {
      requestId: configuration.lastRequestId,
    }).catch(() => {});
  }
  ambientAbortController?.abort();
}

function quietVoiceCapture(quietMs) {
  ignoreVoiceUntilMs = Math.max(ignoreVoiceUntilMs, Date.now() + quietMs);
  if (typeof bot?.discardBufferedVoice === "function") {
    bot.discardBufferedVoice();
  }
}

function rememberStreamingFrame(frame) {
  rememberTurnStartedFrame(frame, configuration);
}

function acceptUserTurn(kind, run) {
  userTurnQueue = enqueueUserTurn(userTurnQueue, { kind, run });
  drainUserTurns().catch((error) => {
    console.error("User turn queue failed:", error.message);
  });
}

async function drainUserTurns() {
  if (drainingTurns) {
    return;
  }
  drainingTurns = true;
  try {
    while (userTurnQueue.length) {
      const item = userTurnQueue.shift();
      activeUserTurnKind = item.kind;
      playAbort.controller = new AbortController();
      try {
        await item.run(playAbort.controller.signal);
      } catch (error) {
        if (isAbortError(error)) {
          console.log(`${item.kind} turn ended.`);
        } else {
          console.error(`${item.kind} turn failed:`, error.message);
        }
      } finally {
        if (activeUserTurnKind === item.kind) {
          activeUserTurnKind = null;
        }
      }
    }
  } finally {
    drainingTurns = false;
  }
}

function rememberThread(turn) {
  if (turn.threadId) {
    configuration.threadId = turn.threadId;
  }
  if (turn.requestId) {
    configuration.lastRequestId = turn.requestId;
  }
}

async function answerLookNowPauses(turn, signal) {
  let currentTurn = turn;
  rememberThread(currentTurn);
  const heardSpeech = currentTurn.spokenTurnText;
  let lookDepth = 0;
  while (isLookNowInterrupt(currentTurn) && lookDepth < MAXIMUM_LOOKS_PER_TURN) {
    const requestedSources = currentTurn.interrupt?.sources || [];
    console.log(
      "look_now requested",
      requestedSources.join(",") || "webcam,screen"
    );
    const screenshotBytes = await captureFirstPersonScreenshot(bot);
    if (screenshotBytes) {
      console.log("look_now sending first-person JPEG", screenshotBytes.length);
    } else {
      console.warn("look_now had no first-person JPEG");
    }
    currentTurn = await postLookNowResume(configuration, {
      threadId: currentTurn.threadId || configuration.threadId,
      screenshotBytes,
      requestedSources,
      signal,
      onFrame: rememberStreamingFrame,
    });
    rememberThread(currentTurn);
    lookDepth += 1;
  }
  if (heardSpeech && !currentTurn.spokenTurnText) {
    currentTurn.spokenTurnText = heardSpeech;
  }
  return currentTurn;
}

async function handleReply(turn) {
  rememberThread(turn);
  const { spokenText: rawSpokenText, commands } = parsePlayCommands(
    turn.content || ""
  );
  const spokenText = stripLeakedSystemPrompt(rawSpokenText);
  const commandWork = commands.length
    ? executePlayCommands(bot, commands, {
        abortSignal: playAbort.controller?.signal,
        onCommand: (command) => {
          console.log("Running", command.name, command.arguments);
        },
      })
    : Promise.resolve([]);
  commandWork.then((results) => {
    const failed = results.filter((result) => result.status === "failed");
    if (failed.length) {
      console.warn(
        "Skill failures:",
        failed.map((result) => `${result.command.name}: ${result.errorMessage}`).join("; ")
      );
    }
  }).catch((error) => {
    console.warn("Play command failed:", error.message);
  });
  try {
    await presentSpokenReply(spokenText);
  } catch (error) {
    console.warn("Cloned voice failed:", error.message);
    saySpokenChatLines(spokenText);
  }
}

function resolveChatUsername(senderUuid) {
  if (senderUuid && bot.player?.uuid && String(senderUuid) === String(bot.player.uuid)) {
    return configuration.minecraftUsername;
  }
  const matched = Object.values(bot.players || {}).find(
    (player) => player?.uuid && String(player.uuid) === String(senderUuid)
  );
  return matched?.username || "";
}

function sayInGameChat(spokenText) {
  const visible = stripLeakedSystemPrompt(spokenText).slice(0, 240);
  if (visible && bot && typeof bot.chat === "function") {
    bot.chat(visible);
  }
}

function saySpokenChatLines(spokenText) {
  for (const line of wrapSpokenChatLines(stripLeakedSystemPrompt(spokenText))) {
    sayInGameChat(line);
  }
}

async function presentSpokenReply(spokenText) {
  const visibleText = stripLeakedSystemPrompt(spokenText);
  if (!visibleText) {
    return;
  }
  if (configuration.voicePlayback === "off") {
    saySpokenChatLines(visibleText);
    return;
  }
  const spoken = await speakText(configuration, visibleText, {
    signal: playAbort.controller?.signal,
  });
  if (spoken.blocked) {
    console.warn("Neural Nexus /speak was busy; posting chat without voice.");
    saySpokenChatLines(visibleText);
    return;
  }
  saySpokenChatLines(visibleText);
  if (!spoken.audioBytes) {
    return;
  }
  quietVoiceCapture(VOICE_QUIET_AFTER_PLAYBACK_MS);
  try {
    await playAvatarVoice(bot, spoken.audioBytes, configuration.voicePlayback);
  } catch (error) {
    console.warn("Voice playback failed:", error.message);
  }
  quietVoiceCapture(VOICE_QUIET_AFTER_PLAYBACK_MS);
}

async function sayCapabilityHelp() {
  const lines = formatCapabilityHelpLines(configuration.minecraftUsername);
  for (const line of lines) {
    sayInGameChat(line);
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

async function handlePlayerChat(username, message) {
  const parsed = normalizeTypedChatMessage(message);
  const speakerName = username || parsed.usernameHint;
  if (!speakerName || speakerName === configuration.minecraftUsername) {
    return;
  }
  const mentionedText = extractDirectedPlayerText(
    parsed.typedText,
    configuration.minecraftUsername
  );
  if (mentionedText === null) {
    console.log(
      "Chat ignored (need @mention or a body phrase):",
      speakerName,
      parsed.typedText.slice(0, 80)
    );
    return;
  }
  if (isPlayCommandHelpRequest(mentionedText) || mentionedText === "") {
    console.log("Capability help requested");
    sayCapabilityHelp().catch((error) => {
      console.warn("Capability help failed:", error.message);
    });
    return;
  }
  console.log("Typed chat from", speakerName, mentionedText);
  const localCommands = extractLocalBodyIntent(mentionedText);
  if (localCommands.length) {
    console.log(
      "Local body intent",
      localCommands.map((command) => command.name).join(", ")
    );
    runLocalBodyIntent(mentionedText).catch((error) => {
      console.warn("Local body intent failed:", error.message);
    });
  }
  acceptUserTurn("typed", async (signal) => {
    await preemptAmbientLook();
    console.log("Sending typed turn to Neural Nexus");
    const turn = await answerLookNowPauses(
      await postTypedChatTurnOrRetry(mentionedText, signal),
      signal
    );
    console.log(
      "Neural Nexus typed reply:",
      String(turn.content || "").replace(/\s+/g, " ").trim().slice(0, 160)
    );
    await handleReply(turn);
  });
}

async function runLocalBodyIntent(typedText) {
  const commands = extractLocalBodyIntent(typedText);
  if (!commands.length) {
    return;
  }
  lastBodyGoalName = commands[0].name === "stop" ? null : commands[0].name;
  const nearbyNames = Object.values(bot.players || {})
    .map((player) => player?.username)
    .filter((name) => name && name !== configuration.minecraftUsername);
  console.log(
    "Body players in range:",
    nearbyNames.join(", ") || "none"
  );
  const results = await executePlayCommands(bot, commands, {
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

async function postMessageTurnOrRetry(kind, startTurn, signal) {
  try {
    return await startTurn();
  } catch (error) {
    if (error.status === 409 && configuration.lastRequestId) {
      console.warn(
        `Neural Nexus still had a turn in flight; stopping it and retrying ${kind}.`
      );
      await stopMessageTurn(configuration, {
        requestId: configuration.lastRequestId,
      }).catch(() => {});
      return await startTurn();
    }
    throw error;
  }
}

async function postTypedChatTurnOrRetry(mentionedText, signal) {
  return postMessageTurnOrRetry(
    "typed chat",
    () =>
      postTypedChatTurn(configuration, {
        playPromptMessage: conversationMessage(mentionedText),
        signal,
        onFrame: rememberStreamingFrame,
      }),
    signal
  );
}

async function postSpokenTurnOrRetry(utteranceBytes, signal) {
  return postMessageTurnOrRetry(
    "spoken chat",
    () =>
      postSpokenTurn(configuration, {
        playPromptMessage: "",
        utteranceBytes,
        signal,
        onFrame: rememberStreamingFrame,
      }),
    signal
  );
}

async function handleSpokenUtterance(utteranceBytes, senderName) {
  if (!utteranceBytes || utteranceBytes.length < MINIMUM_SPOKEN_UTTERANCE_BYTES) {
    return;
  }
  console.log("Spoken utterance queued from", senderName || "unknown");
  acceptUserTurn("spoken", async (signal) => {
    await preemptAmbientLook();
    const turn = await answerLookNowPauses(
      await postSpokenTurnOrRetry(utteranceBytes, signal),
      signal
    );
    console.log(
      "Neural Nexus spoken reply:",
      stripLeakedSystemPrompt(turn.content || "").slice(0, 160)
    );
    if (turn.spokenTurnText) {
      const heardSpeech = stripLeakedSystemPrompt(turn.spokenTurnText);
      console.log("Heard:", heardSpeech.slice(0, 120));
      if (isPlayCommandHelpRequest(heardSpeech)) {
        console.log("Capability help requested from spoken turn");
        await sayCapabilityHelp();
        return;
      }
      await runLocalBodyIntent(turn.spokenTurnText);
    }
    await handleReply(turn);
  });
}

async function sendAmbientLook() {
  if (neuralNexusIsBusy()) {
    return;
  }
  const screenshotBytes = await captureFirstPersonScreenshot(bot);
  if (!screenshotBytes || playerTurnIsInFlight()) {
    return;
  }
  ambientLookInFlight = true;
  ambientAbortController = new AbortController();
  console.log("Ambient look sent");
  try {
    const turn = await postAmbientLook(configuration, {
      screenshotBytes,
      playPromptMessage: "",
      signal: ambientAbortController.signal,
      onFrame: rememberStreamingFrame,
    });
    if (playerTurnIsInFlight()) {
      return;
    }
    rememberThread(turn);
    await runAmbientBodyAutonomy();
    if (playerTurnIsInFlight()) {
      return;
    }
    if (turn.ambientDecision?.decision === "respond" && turn.content) {
      await handleReply(turn);
    }
  } catch (error) {
    if (isAbortError(error)) {
      console.log("Ambient look ended for a player turn.");
      return;
    }
    throw error;
  } finally {
    ambientLookInFlight = false;
    ambientAbortController = null;
  }
}

async function runAmbientBodyAutonomy() {
  if (playerTurnIsInFlight()) {
    return;
  }
  if (lastBodyGoalName === "follow") {
    if (bot.pathfinder?.goal) {
      return;
    }
    console.log("Ambient autonomy: continue follow");
    await runLocalBodyIntent("follow me");
    return;
  }
  const nearby = firstOtherPlayer(bot);
  if (nearby && bot.entity) {
    const distance = bot.entity.position.distanceTo(nearby.position);
    if (distance > 6 && distance < 24) {
      console.log("Ambient autonomy: walk toward", nearby.username || "player");
      await runLocalBodyIntent("come here");
    }
  }
}

async function sendIdlePlayTurn() {
  if (playerTurnIsInFlight()) {
    return;
  }
  await runAmbientBodyAutonomy();
}
