/**
 * Join the local Fabric server and quit after spawn.
 * Usage: node scripts/join-fabric-smoke.js [host] [port]
 */
import mineflayer from "mineflayer";
import { captureFirstPersonScreenshot } from "../companion/src/bot/captureFirstPersonScreenshot.js";

const host = process.argv[2] || "127.0.0.1";
const port = Number.parseInt(process.argv[3] || "25565", 10);

const bot = mineflayer.createBot({
  host,
  port,
  username: "JoinSmoke",
  auth: "offline",
  version: "1.21.1",
});

const timeout = setTimeout(() => {
  console.error("Join smoke timed out.");
  process.exit(1);
}, 60000);

bot.once("spawn", async () => {
  clearTimeout(timeout);
  const position = bot.entity.position;
  console.log(
    `JOIN_OK ${position.x.toFixed(1)},${position.y.toFixed(1)},${position.z.toFixed(1)}`
  );
  try {
    const screenshotBytes = await captureFirstPersonScreenshot(bot);
    if (screenshotBytes && screenshotBytes[0] === 0xff && screenshotBytes[1] === 0xd8) {
      console.log(`SCREENSHOT_OK ${screenshotBytes.length}`);
    } else {
      console.error("SCREENSHOT_FAIL");
      bot.quit();
      setTimeout(() => process.exit(1), 500);
      return;
    }
  } catch (error) {
    console.error("SCREENSHOT_FAIL", error.message);
    bot.quit();
    setTimeout(() => process.exit(1), 500);
    return;
  }
  bot.quit();
  setTimeout(() => process.exit(0), 500);
});

bot.on("error", (error) => {
  clearTimeout(timeout);
  console.error(error.message);
  process.exit(1);
});

bot.on("kicked", (reason) => {
  clearTimeout(timeout);
  console.error("kicked", reason);
  process.exit(1);
});
