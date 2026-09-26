// Mindcraft's automatic behaviours ("modes", kolbytn/mindcraft
// src/agent/modes.js), run on a one-second tick.
//
// Defaults differ from Mindcraft on purpose where a mode moves the body
// without being asked: a companion that wanders off to hunt, to make elbow
// room, or to run from a zombie is exactly the autonomy that got in the way of
// following instructions. Those modes exist and can be switched on with
// !setMode; the modes that keep the body alive (self_preservation,
// self_defense, unstuck) and the harmless ones (item_collecting while idle,
// idle_staring) start on. Every mode that walks the body respects the hold a
// "stop" or "wait here" places, and never runs while a job is in flight.

import pathfinderPackage from "mineflayer-pathfinder";
import { isHostileEntity } from "./mindcraftSkills.js";

const { goals } = pathfinderPackage;

const HUNTABLE_ANIMAL_NAMES = ["cow", "pig", "chicken", "sheep", "rabbit"];
const EAT_COOLDOWN_MS = 10000;
const STUCK_SECONDS = 10;

export const MODE_DEFINITIONS = {
  self_preservation: {
    description: "Escape water and lava, and eat at low health. Interrupts everything.",
    defaultOn: true,
  },
  unstuck: {
    description: "Jump free when a walk has not moved for a while.",
    defaultOn: true,
  },
  cowardice: {
    description: "Run from enemies at low health.",
    defaultOn: false,
  },
  self_defense: {
    description: "Hit enemies that come close.",
    defaultOn: true,
  },
  hunting: {
    description: "Hunt nearby animals when idle.",
    defaultOn: false,
  },
  item_collecting: {
    description: "Pick up nearby dropped items when idle.",
    defaultOn: true,
  },
  torch_placing: {
    description: "Place a torch when idle and no torch is nearby.",
    defaultOn: false,
  },
  elbow_room: {
    description: "Step away from a player standing on top of the body when idle.",
    defaultOn: false,
  },
  idle_staring: {
    description: "Look at nearby players and animals when idle.",
    defaultOn: true,
  },
  cheat: {
    description: "Teleport instead of walking (needs operator permission).",
    defaultOn: false,
  },
};

export function createModeState() {
  return Object.fromEntries(
    Object.entries(MODE_DEFINITIONS).map(([modeName, definition]) => [modeName, definition.defaultOn])
  );
}

export function setModeInState(modeState, modeName, enabled) {
  if (!(modeName in MODE_DEFINITIONS)) {
    return false;
  }
  modeState[modeName] = Boolean(enabled);
  return true;
}

export function describeModeState(modeState) {
  return Object.entries(MODE_DEFINITIONS)
    .map(([modeName, definition]) => `${modeName} ${modeState[modeName] ? "ON" : "off"}: ${definition.description}`)
    .join(" | ");
}

function nearestEntity(bot, predicate, range) {
  const origin = bot.entity?.position;
  if (!origin) {
    return null;
  }
  return (
    Object.values(bot.entities || {})
      .filter((entity) => entity !== bot.entity && entity.position && predicate(entity))
      .filter((entity) => entity.position.distanceTo(origin) <= range)
      .sort((left, right) => left.position.distanceTo(origin) - right.position.distanceTo(origin))[0] ||
    null
  );
}

// Start the tick. ``companion`` supplies what only the companion knows:
// whether the player is holding the body still, whether a job or a turn is in
// flight, and how to pick up drops.
export function startModeTick(bot, modeState, companion) {
  let lastEatAt = 0;
  let stuckSince = null;
  let stuckPosition = null;
  let busy = false;

  const tick = async () => {
    if (busy || !bot.entity) {
      return;
    }
    busy = true;
    try {
      const position = bot.entity.position;
      const idle = !companion.jobInFlight() && !bot.pathfinder?.goal && !companion.turnInFlight();
      const mayWalk = companion.mayWalk();

      if (modeState.self_preservation) {
        if (bot.entity.isInWater || bot.entity.isInLava) {
          bot.setControlState("jump", true);
          setTimeout(() => bot.setControlState("jump", false), 400);
        }
        if ((bot.health ?? 20) <= 6 && Date.now() - lastEatAt > EAT_COOLDOWN_MS) {
          const food = bot.inventory.items().find((item) => item.foodRestore || bot.registry.foodsByName?.[item.name]);
          if (food) {
            lastEatAt = Date.now();
            await bot.equip(food, "hand").then(() => bot.consume()).catch(() => {});
          }
        }
      }

      if (modeState.unstuck && bot.pathfinder?.isMoving?.()) {
        if (!stuckPosition || position.distanceTo(stuckPosition) > 0.5) {
          stuckPosition = position.clone();
          stuckSince = Date.now();
        } else if (Date.now() - stuckSince > STUCK_SECONDS * 1000) {
          bot.setControlState("jump", true);
          setTimeout(() => bot.setControlState("jump", false), 500);
          stuckSince = Date.now();
        }
      } else {
        stuckPosition = null;
      }

      const hostile = nearestEntity(bot, isHostileEntity, 8);
      if (hostile && modeState.cowardice && (bot.health ?? 20) < 10 && mayWalk) {
        const away = hostile.position;
        bot.pathfinder.setGoal(new goals.GoalInvert(new goals.GoalNear(away.x, away.y, away.z, 16)), true);
      } else if (hostile && modeState.self_defense && hostile.position.distanceTo(position) <= 4) {
        await bot.lookAt(hostile.position.offset(0, (hostile.height || 1.6) * 0.8, 0));
        bot.attack(hostile);
      }

      if (!idle) {
        return;
      }

      if (modeState.item_collecting && mayWalk) {
        await companion.pickUpDrops();
      }

      if (modeState.hunting && mayWalk) {
        const animal = nearestEntity(bot, (entity) => HUNTABLE_ANIMAL_NAMES.includes(entity.name), 8);
        if (animal) {
          await bot.pathfinder.goto(new goals.GoalNear(animal.position.x, animal.position.y, animal.position.z, 2)).catch(() => {});
          bot.attack(animal);
        }
      }

      if (modeState.torch_placing) {
        const torch = bot.inventory.items().find((item) => item.name === "torch");
        const torchNearby = bot.findBlock?.({ matching: (block) => block && block.name.includes("torch"), maxDistance: 8 });
        if (torch && !torchNearby) {
          await companion.placeBlockBeside("torch").catch(() => {});
        }
      }

      if (modeState.elbow_room && mayWalk) {
        const crowding = nearestEntity(bot, (entity) => entity.type === "player", 1.2);
        if (crowding) {
          const origin = position.clone();
          await bot.pathfinder.goto(new goals.GoalInvert(new goals.GoalNear(origin.x, origin.y, origin.z, 2))).catch(() => {});
        }
      }

      if (modeState.idle_staring) {
        const watched = nearestEntity(bot, (entity) => entity.type === "player" || entity.type === "mob" || entity.type === "animal", 12);
        if (watched) {
          await bot.lookAt(watched.position.offset(0, (watched.height || 1.6) * 0.9, 0)).catch(() => {});
        }
      }
    } catch {
      // A mode is an aid; a failed tick is skipped, never fatal.
    } finally {
      busy = false;
    }
  };

  return setInterval(() => {
    tick();
  }, 1000);
}
