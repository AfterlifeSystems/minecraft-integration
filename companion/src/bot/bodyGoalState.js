import {
  commandHoldsTheBody,
  commandReleasesTheBody,
} from "./extractLocalBodyIntent.js";

// What the body was last told to do, whether the player told the body to hold
// still, and how many jobs are running. Ambient autonomy reads this state so
// autonomy never overrides the player: a "stop" or "wait here" holds until the
// player asks for movement again, and a running job (collecting wood, digging)
// is never replaced by a walk toward the nearest player.
export function createBodyGoalState() {
  return { goalName: null, held: false, jobsInFlight: 0 };
}

// Record commands from either source, the local fast path or the avatar's
// minecraft_act frame, so both leave the body in the same state.
export function recordBodyCommands(bodyGoalState, commands) {
  for (const command of commands || []) {
    if (commandHoldsTheBody(command)) {
      bodyGoalState.held = true;
      bodyGoalState.goalName = null;
      continue;
    }
    if (commandReleasesTheBody(command)) {
      bodyGoalState.held = false;
    }
    bodyGoalState.goalName = command.name;
  }
  return bodyGoalState;
}

export function autonomyMayMoveBody(bodyGoalState) {
  return !bodyGoalState.held && bodyGoalState.jobsInFlight === 0;
}

// Run a job and count the job as in flight until the job settles.
export async function trackBodyJob(bodyGoalState, runJob) {
  bodyGoalState.jobsInFlight += 1;
  try {
    return await runJob();
  } finally {
    bodyGoalState.jobsInFlight = Math.max(0, bodyGoalState.jobsInFlight - 1);
  }
}

// A look_now pause splits one reply into legs, and each leg is its own
// stream. The minecraft_act commands of every leg belong to the same reply.
export function mergeMinecraftActs(earlierAct, laterAct) {
  if (!earlierAct) {
    return laterAct || null;
  }
  if (!laterAct) {
    return earlierAct;
  }
  return {
    commands: [...(earlierAct.commands || []), ...(laterAct.commands || [])],
    additional_as_is_text:
      laterAct.additional_as_is_text || earlierAct.additional_as_is_text || "",
  };
}

// Commands the local fast path already covered as part of a larger job.
// giveCollected walks to the player and tosses every stack; a later goToPlayer
// or toss from the avatar would restart that trip or drop items again.
const COMMANDS_COVERED_BY_LOCAL = {
  giveCollected: ["giveCollected", "goToPlayer", "toss", "givePlayer"],
};

function commandNamesAlreadyCovered(alreadyRunCommands) {
  const coveredNames = new Set();
  for (const command of alreadyRunCommands || []) {
    const relatedNames = COMMANDS_COVERED_BY_LOCAL[command.name] || [command.name];
    for (const relatedName of relatedNames) {
      coveredNames.add(relatedName);
    }
  }
  return coveredNames;
}

// The local fast path already started these commands for this turn; running
// the avatar's copy of the same command again would restart the job.
export function commandsNotAlreadyRun(commands, alreadyRunCommands) {
  const alreadyRunNames = commandNamesAlreadyCovered(alreadyRunCommands);
  return (commands || []).filter((command) => !alreadyRunNames.has(command.name));
}

export function describeCommands(commands) {
  return (commands || [])
    .map((command) => `${command.name}(${(command.arguments || []).join(", ")})`)
    .join(" ");
}
