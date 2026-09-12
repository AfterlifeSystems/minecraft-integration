import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

test("Fabric start scripts exist and copy jars from mods/", () => {
  const startShell = resolve("server/start.sh");
  const startPowerShell = resolve("server/start.ps1");
  assert.equal(existsSync(startShell), true);
  assert.equal(existsSync(startPowerShell), true);
  const shellText = readFileSync(startShell, "utf8");
  const powerShellText = readFileSync(startPowerShell, "utf8");
  assert.match(shellText, /\.\.\/mods/);
  assert.match(shellText, /find-java/);
  assert.match(powerShellText, /ValidateOnly/);
  assert.match(powerShellText, /\.jar/);
  assert.equal(existsSync(resolve("server/find-java.sh")), true);
});
