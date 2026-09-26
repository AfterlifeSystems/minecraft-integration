import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_AMBIENT_CAPTURE_INTERVAL_SECONDS = 30;

// AMBIENT_CAPTURE_INTERVAL_SECONDS=-1 turns ambient capture off completely:
// no timer, no first-person JPEG, no ambient spend. The avatar still sees on
// demand through look_now.
export const AMBIENT_CAPTURE_DISABLED = -1;
const DEFAULT_IDLE_PLAY_INTERVAL_SECONDS = 45;
const DEFAULT_MINECRAFT_SERVER_PORT = 25565;
const DEFAULT_MINECRAFT_AUTH = "offline";
const DEFAULT_MINECRAFT_USERNAME = "NeuralNexus";
const DEFAULT_VOICE_PLAYBACK = "auto";

export function parseDotEnvValue(rawValue) {
  const value = String(rawValue ?? "").trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  // An unquoted value ends at a trailing comment. Without this strip,
  // AMBIENT_CAPTURE_INTERVAL_SECONDS=-1 # off parses as the string "-1 # off"
  // rather than the number -1.
  return value.replace(/\s+#.*$/, "").trim();
}

function loadDotEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }
  const text = readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = parseDotEnvValue(line.slice(separatorIndex + 1));
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requiredText(name) {
  const value = (process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required. Copy .env.example to .env and set the empty fields.`);
  }
  return value;
}

function optionalText(name, fallback) {
  const value = (process.env[name] || "").trim();
  return value || fallback;
}

function optionalInteger(name, fallback) {
  const raw = (process.env[name] || "").trim();
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be an integer.`);
  }
  return parsed;
}

export function ambientCaptureIsDisabled(ambientCaptureIntervalSeconds) {
  return ambientCaptureIntervalSeconds === AMBIENT_CAPTURE_DISABLED;
}

export function normalizeAmbientCaptureIntervalSeconds(seconds) {
  if (seconds < 0) {
    return AMBIENT_CAPTURE_DISABLED;
  }
  if (seconds < 1) {
    // setInterval treats a zero delay as "fire every millisecond", which sent
    // ambient looks back to back for as long as the companion stayed up.
    throw new Error(
      "AMBIENT_CAPTURE_INTERVAL_SECONDS must be at least 1, or -1 to disable ambient capture."
    );
  }
  return seconds;
}

function ambientCaptureIntervalSecondsFromEnvironment() {
  return normalizeAmbientCaptureIntervalSeconds(
    optionalInteger(
      "AMBIENT_CAPTURE_INTERVAL_SECONDS",
      DEFAULT_AMBIENT_CAPTURE_INTERVAL_SECONDS
    )
  );
}

export function loadCompanionConfiguration(repositoryRoot = process.cwd()) {
  loadDotEnvFile(resolve(repositoryRoot, ".env"));

  const neuralNexusApiBaseUrl = requiredText("NEURAL_NEXUS_API_BASE_URL").replace(
    /\/+$/,
    ""
  );

  return {
    neuralNexusApiBaseUrl,
    apiKey: requiredText("API_KEY"),
    assistantId: requiredText("ASSISTANT_ID"),
    minecraftServerHost: optionalText("MINECRAFT_SERVER_HOST", "127.0.0.1"),
    minecraftServerPort: optionalInteger(
      "MINECRAFT_SERVER_PORT",
      DEFAULT_MINECRAFT_SERVER_PORT
    ),
    minecraftUsername: optionalText(
      "MINECRAFT_USERNAME",
      DEFAULT_MINECRAFT_USERNAME
    ),
    minecraftAuth: optionalText("MINECRAFT_AUTH", DEFAULT_MINECRAFT_AUTH),
    userTimezone: optionalText("USER_TIMEZONE", ""),
    ambientCaptureIntervalSeconds: ambientCaptureIntervalSecondsFromEnvironment(),
    idlePlayIntervalSeconds: optionalInteger(
      "IDLE_PLAY_INTERVAL_SECONDS",
      DEFAULT_IDLE_PLAY_INTERVAL_SECONDS
    ),
    voicePlayback: optionalText("VOICE_PLAYBACK", DEFAULT_VOICE_PLAYBACK),
    // Players allowed to type "!" commands. Empty lets every player on the
    // server type them, as Mindcraft does; a public server names its players.
    directCommandPlayers: optionalText("DIRECT_COMMAND_PLAYERS", "")
      .split(",")
      .map((playerName) => playerName.trim())
      .filter(Boolean),
  };
}

export function assistantIdFingerprint(assistantId) {
  const value = String(assistantId || "").trim();
  if (value.length < 12) {
    return value;
  }
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export function validateCompanionConfiguration(configuration) {
  if (!configuration.neuralNexusApiBaseUrl) {
    throw new Error("NEURAL_NEXUS_API_BASE_URL is required.");
  }
  if (!configuration.apiKey) {
    throw new Error("API_KEY is required.");
  }
  if (!configuration.assistantId) {
    throw new Error("ASSISTANT_ID is required.");
  }
  return true;
}
