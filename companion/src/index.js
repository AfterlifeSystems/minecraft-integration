import { installFlushingConsole } from "./bot/flushingConsole.js";
import {
  ambientCaptureIsDisabled,
  assistantIdFingerprint,
  loadCompanionConfiguration,
} from "./configuration.js";
import {
  isLookNowInterrupt,
  postAmbientLook,
  postLookNowResume,
  postSpokenTurn,
  postIdlePlayTurn,
  postTypedChatTurn,
  speakText,
  stopMessageTurn,
} from "./nexus/neuralNexusApi.js";
import { buildWorldSnapshotText, firstOtherPlayer } from "./world/worldSnapshot.js";
import {
  commandsFromMinecraftAct,
  parsePlayCommands,
} from "./actions/parsePlayCommands.js";
import { executePlayCommands } from "./actions/executePlayCommands.js";
import {
  parseTypedCommand,
  playerMayTypeCommands,
  typedCommandHelpLines,
} from "./actions/typedCommands.js";
import {
  createModeState,
  describeModeState,
  setModeInState,
  startModeTick,
} from "./skills/modes.js";
import {
  QUERY_COMMAND_NAMES,
  pickUpNearbyDrops,
  resolveCommandName,
  runSkill,
} from "./skills/skillLibrary.js";
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
import {
  autonomyMayMoveBody,
  commandsNotAlreadyRun,
  createBodyGoalState,
  describeCommands,
  mergeMinecraftActs,
  recordBodyCommands,
  trackBodyJob,
} from "./bot/bodyGoalState.js";
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
const POSITION_LOG_INTERVAL_MS = 10000;
let bot;
let ambientTimer = null;
let idleTimer = null;
let positionLogTimer = null;
let lastLoggedPositionText = null;
let reconnectTimer = null;
const bodyGoalState = createBodyGoalState();
const modeState = createModeState();
let modeTimer = null;
let goalTimer = null;
let holdReleaseTimer = null;
// The standing goal set by !goal: while set, the companion prompts Neural
// Nexus to pick the next commands whenever the body is idle, the way a
// Mindcraft agent self-prompts. Capped so a goal that never finishes cannot
// run up an unbounded bill.
let standingGoal = null;
let standingGoalTurns = 0;
const MAXIMUM_GOAL_TURNS = 30;
const GOAL_TICK_MS = 8000;
// Set by !stfu: unprompted speech (goal turns, ambient replies) stays quiet.
let unpromptedSpeechMuted = false;
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

  installCompanionHooks();

  bot.once("spawn", () => {
    if (modeTimer) {
      clearInterval(modeTimer);
    }
    modeTimer = startModeTick(bot, modeState, {
      jobInFlight: () => bodyGoalState.jobsInFlight > 0,
      turnInFlight: () => playerTurnIsInFlight(),
      mayWalk: () => !bodyGoalState.held && bodyGoalState.goalName !== "follow",
      pickUpDrops: () => pickUpNearbyDrops(bot),
      placeBlockBeside: (blockName) => runSkill(bot, { name: "placeBlock", arguments: [blockName] }),
    });
    if (goalTimer) {
      clearInterval(goalTimer);
    }
    goalTimer = setInterval(() => {
      advanceStandingGoal().catch((error) => {
        console.warn("Goal turn failed:", error.message);
      });
    }, GOAL_TICK_MS);
    if (ambientTimer) {
      clearInterval(ambientTimer);
    }
    if (idleTimer) {
      clearInterval(idleTimer);
    }
    if (positionLogTimer) {
      clearInterval(positionLogTimer);
    }
    logCompanionWorldPosition();
    positionLogTimer = setInterval(logCompanionWorldPosition, POSITION_LOG_INTERVAL_MS);
    if (ambientCaptureIsDisabled(configuration.ambientCaptureIntervalSeconds)) {
      console.log(
        "Ambient capture disabled (AMBIENT_CAPTURE_INTERVAL_SECONDS=-1); the avatar looks only on demand."
      );
    } else {
      ambientTimer = setInterval(() => {
        sendAmbientLook().catch((error) => {
          console.warn("Ambient look failed:", error.message);
        });
      }, configuration.ambientCaptureIntervalSeconds * 1000);
    }

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
    if (positionLogTimer) {
      clearInterval(positionLogTimer);
      positionLogTimer = null;
    }
    if (modeTimer) {
      clearInterval(modeTimer);
      modeTimer = null;
    }
    if (goalTimer) {
      clearInterval(goalTimer);
      goalTimer = null;
    }
    lastLoggedPositionText = null;
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

function refreshMinecraftWorldSnapshot() {
  configuration.minecraftWorldSnapshot = buildWorldSnapshotText(bot);
  logCompanionWorldPosition();
}

// Print the companion's coordinates, dimension, and biome so `docker compose
// logs -f companion` shows where in the world the companion currently stands.
// A repeated line is skipped so a stationary companion does not flood the log.
function logCompanionWorldPosition() {
  const companionEntity = bot?.entity;
  if (!companionEntity) {
    return;
  }
  const companionPosition = companionEntity.position;
  const companionDimension = bot.game?.dimension || "unknown";
  const companionBiome = bot.blockAt(companionPosition)?.biome?.name || "unknown";
  const positionText =
    `Companion position x=${companionPosition.x.toFixed(1)} ` +
    `y=${companionPosition.y.toFixed(1)} z=${companionPosition.z.toFixed(1)} ` +
    `dimension=${companionDimension} biome=${companionBiome}`;
  if (positionText === lastLoggedPositionText) {
    return;
  }
  lastLoggedPositionText = positionText;
  console.log(positionText);
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
    console.log("look_now requested", requestedSources.join(",") || "screen");
    const earlierMinecraftAct = currentTurn.minecraftAct;
    const screenshotBytes = await captureFirstPersonScreenshot(bot);
    if (screenshotBytes) {
      console.log("look_now sending first-person JPEG", screenshotBytes.length);
    } else {
      console.warn("look_now had no first-person JPEG");
    }
    refreshMinecraftWorldSnapshot();
    currentTurn = await postLookNowResume(configuration, {
      threadId: currentTurn.threadId || configuration.threadId,
      screenshotBytes,
      requestedSources,
      signal,
      onFrame: rememberStreamingFrame,
    });
    // Commands the avatar sent before the pause belong to this reply too.
    currentTurn.minecraftAct = mergeMinecraftActs(
      earlierMinecraftAct,
      currentTurn.minecraftAct
    );
    rememberThread(currentTurn);
    lookDepth += 1;
  }
  if (heardSpeech && !currentTurn.spokenTurnText) {
    currentTurn.spokenTurnText = heardSpeech;
  }
  return currentTurn;
}

// Run body commands from either source and keep the body's goal state honest:
// a stop holds the body against ambient autonomy, and a running job counts as
// in flight so autonomy never replaces the job with a walk toward a player.
// A failed job is said in chat, so a job the avatar announced but the body
// could not do is visible instead of silent.
// Commands that leave a running job alone: looking, talking, gestures,
// memory and settings, and every query. Any other command is a new order, and
// a new order replaces the job in progress the way a player's new instruction
// would, so "come here" while gathering wood ends the gathering quietly
// instead of reporting "Couldn't finish: Digging aborted".
const COMMANDS_THAT_KEEP_THE_RUNNING_JOB = new Set([
  "lookAt",
  "lookAtPlayer",
  "lookAtPosition",
  "say_chat",
  "jump",
  "sneak",
  "stfu",
  "setMode",
  "rememberHere",
  "clearChat",
  "startConversation",
  "endConversation",
  "goal",
  "endGoal",
  ...QUERY_COMMAND_NAMES,
]);

function commandReplacesTheRunningJob(command) {
  const commandName = resolveCommandName(command?.name) || command?.name;
  return !COMMANDS_THAT_KEEP_THE_RUNNING_JOB.has(commandName);
}

function runBodyCommands(commands, { abortSignal } = {}) {
  if (!commands.length) {
    return Promise.resolve([]);
  }
  if (commands.some(commandReplacesTheRunningJob)) {
    bot.nexusJobGeneration = (bot.nexusJobGeneration || 0) + 1;
  }
  recordBodyCommands(bodyGoalState, commands);
  return trackBodyJob(bodyGoalState, () =>
    executePlayCommands(bot, commands, {
      abortSignal,
      onCommand: (command) => {
        console.log("Running", command.name, command.arguments);
      },
    })
  ).then((results) => {
    const failed = results.filter((result) => result.status === "failed");
    if (failed.length) {
      console.warn(
        "Skill failures:",
        failed.map((result) => `${result.command.name}: ${result.errorMessage}`).join("; ")
      );
      sayInGameChat(`Couldn't finish: ${failed[0].errorMessage}`);
    }
    return results;
  });
}

async function handleReply(turn, { alreadyRunCommands = [] } = {}) {
  rememberThread(turn);
  const fromFrame = commandsFromMinecraftAct(turn.minecraftAct);
  const { spokenText: rawSpokenText, commands: parsedCommands } =
    parsePlayCommands(turn.content || "");
  const spokenText = stripLeakedSystemPrompt(rawSpokenText);
  const avatarCommands = fromFrame.length ? fromFrame : parsedCommands;
  console.log(
    "Avatar act:",
    avatarCommands.length ? describeCommands(avatarCommands) : "none"
  );
  const commands = commandsNotAlreadyRun(avatarCommands, alreadyRunCommands);
  const additionalAsIsText = String(
    turn.minecraftAct?.additional_as_is_text || ""
  );
  if (additionalAsIsText) {
    console.log("Minecraft additional as-is text:", additionalAsIsText.slice(0, 160));
  }
  runBodyCommands(commands, {
    abortSignal: playAbort.controller?.signal,
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
  const typedCommand =
    parseTypedCommand(parsed.typedText) ||
    parseTypedCommand(
      String(parsed.typedText || "").replace(
        new RegExp(`^@?${configuration.minecraftUsername}[,:]?\\s*`, "i"),
        ""
      )
    );
  if (typedCommand) {
    await runTypedCommand(speakerName, typedCommand);
    return;
  }
  unpromptedSpeechMuted = false;
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
  const alreadyRunCommands = localCommands;
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
    await handleReply(turn, { alreadyRunCommands });
  });
}

async function runLocalBodyIntent(typedText) {
  const commands = extractLocalBodyIntent(typedText);
  if (!commands.length) {
    return [];
  }
  const nearbyNames = Object.values(bot.players || {})
    .map((player) => player?.username)
    .filter((name) => name && name !== configuration.minecraftUsername);
  console.log(
    "Body players in range:",
    nearbyNames.join(", ") || "none"
  );
  // Started, not awaited: a job such as gathering wood runs for many seconds
  // and the avatar's reply must not wait behind the job.
  runBodyCommands(commands).catch((error) => {
    console.warn("Local body intent failed:", error.message);
  });
  return commands;
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
  refreshMinecraftWorldSnapshot();
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
  refreshMinecraftWorldSnapshot();
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
    let alreadyRunCommands = [];
    if (turn.spokenTurnText) {
      const heardSpeech = stripLeakedSystemPrompt(turn.spokenTurnText);
      console.log("Heard:", heardSpeech.slice(0, 120));
      if (isPlayCommandHelpRequest(heardSpeech)) {
        console.log("Capability help requested from spoken turn");
        await sayCapabilityHelp();
        return;
      }
      alreadyRunCommands = await runLocalBodyIntent(turn.spokenTurnText);
    }
    await handleReply(turn, { alreadyRunCommands });
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

// Autonomy fills idle time and never overrides the player: a stop or "wait
// here" holds the body until the player asks for movement again, and a
// running job (gathering, digging) is never replaced by a walk.
async function runAmbientBodyAutonomy() {
  if (playerTurnIsInFlight() || !autonomyMayMoveBody(bodyGoalState)) {
    return;
  }
  if (bodyGoalState.goalName === "follow") {
    if (bot.pathfinder?.goal) {
      return;
    }
    console.log("Ambient autonomy: continue follow");
    await runLocalBodyIntent("follow me");
    return;
  }
  // Only a body with no standing goal wanders over to a player. A body the
  // player gave a job to, or that finished a job, stays where the job left
  // the body.
  if (bodyGoalState.goalName) {
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

// What only the companion holds, reachable from a skill runner: the chat
// mute, the Neural Nexus thread, the hold, the standing goal, and the modes.
function installCompanionHooks() {
  bot.nexusHooks = {
    setQuiet: (quiet) => {
      unpromptedSpeechMuted = Boolean(quiet);
      if (quiet) {
        setStandingGoal(null);
      }
    },
    clearChat: () => {
      configuration.threadId = null;
    },
    holdFor: (seconds) => {
      recordBodyCommands(bodyGoalState, [{ name: "stop", arguments: [] }]);
      if (holdReleaseTimer) {
        clearTimeout(holdReleaseTimer);
        holdReleaseTimer = null;
      }
      if (Number(seconds) >= 0) {
        holdReleaseTimer = setTimeout(() => {
          holdReleaseTimer = null;
          bodyGoalState.held = false;
        }, Number(seconds) * 1000);
      }
    },
    setGoal: (goalText) => setStandingGoal(goalText),
    setMode: (modeName, enabled) => setModeInState(modeState, modeName, enabled),
    modeIsOn: (modeName) => Boolean(modeState[modeName]),
    describeModes: () => describeModeState(modeState),
  };
}

function setStandingGoal(goalText) {
  standingGoal = goalText ? String(goalText) : null;
  standingGoalTurns = 0;
  console.log(standingGoal ? `Standing goal: ${standingGoal}` : "Standing goal ended");
}

// A "!" line runs on the body at once, like a Mindcraft command: no Neural
// Nexus turn, no look, and the result or the failure is posted in chat.
async function runTypedCommand(speakerName, typedCommand) {
  if (!playerMayTypeCommands(speakerName, configuration.directCommandPlayers)) {
    console.log("Typed command refused for", speakerName, typedCommand.name);
    return;
  }
  console.log("Typed command from", speakerName, `!${typedCommand.name}`, typedCommand.arguments);
  if (typedCommand.name.toLowerCase() === "help") {
    for (const line of typedCommandHelpLines()) {
      sayInGameChat(line);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    return;
  }
  if (!typedCommand.known) {
    sayInGameChat(`I don't know !${typedCommand.name}. Type !help for the list.`);
    return;
  }
  const results = await runBodyCommands([
    { name: typedCommand.name, arguments: typedCommand.arguments },
  ]);
  const output = results.find((result) => result.status === "ok")?.output;
  if (output) {
    for (const line of wrapSpokenChatLines(output)) {
      sayInGameChat(line);
    }
  }
}

// One self-prompted turn toward the standing goal, when nothing else is
// happening: no player turn, no running job, and the body not held still.
async function advanceStandingGoal() {
  if (
    !standingGoal ||
    unpromptedSpeechMuted ||
    playerTurnIsInFlight() ||
    ambientLookInFlight ||
    bodyGoalState.jobsInFlight > 0 ||
    bodyGoalState.held
  ) {
    return;
  }
  if (standingGoalTurns >= MAXIMUM_GOAL_TURNS) {
    sayInGameChat(`Pausing the goal after ${MAXIMUM_GOAL_TURNS} steps. Type !goal again to keep going.`);
    setStandingGoal(null);
    return;
  }
  standingGoalTurns += 1;
  const goalText = standingGoal;
  acceptUserTurn("goal", async (signal) => {
    refreshMinecraftWorldSnapshot();
    console.log(`Goal step ${standingGoalTurns}: ${goalText}`);
    const turn = await answerLookNowPauses(
      await postIdlePlayTurn(configuration, {
        playPromptMessage:
          `(Standing goal, step ${standingGoalTurns}) Keep working toward this goal: ${goalText}. ` +
          "Choose the next commands from what MINECRAFT_WORLD shows and call act_in_minecraft. " +
          "When the goal is complete, call act_in_minecraft with endGoal. Keep any spoken words to one short sentence.",
        signal,
        onFrame: rememberStreamingFrame,
      }),
      signal
    );
    await handleReply(turn, { speakAloud: false });
  });
}

async function sendIdlePlayTurn() {
  if (playerTurnIsInFlight()) {
    return;
  }
  await runAmbientBodyAutonomy();
}
