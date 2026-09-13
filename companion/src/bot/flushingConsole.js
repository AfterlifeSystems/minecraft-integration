import { writeSync } from "node:fs";
import { format } from "node:util";

function writeUnbuffered(fd, args) {
  writeSync(fd, `${format(...args)}\n`);
}

export function installFlushingConsole() {
  console.log = (...args) => writeUnbuffered(1, args);
  console.info = (...args) => writeUnbuffered(1, args);
  console.warn = (...args) => writeUnbuffered(2, args);
  console.error = (...args) => writeUnbuffered(2, args);
}
