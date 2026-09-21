import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AMBIENT_CAPTURE_DISABLED,
  ambientCaptureIsDisabled,
  assistantIdFingerprint,
  normalizeAmbientCaptureIntervalSeconds,
  parseDotEnvValue,
  validateCompanionConfiguration,
} from "../companion/src/configuration.js";

test("configuration validation requires the serving API fields", () => {
  assert.throws(() => validateCompanionConfiguration({}), /NEURAL_NEXUS_API_BASE_URL/);
  assert.equal(
    validateCompanionConfiguration({
      neuralNexusApiBaseUrl: "http://127.0.0.1:8080",
      apiKey: "key",
      assistantId: "avatar-1",
    }),
    true
  );
});

test("assistant fingerprint hides the middle of the avatar id", () => {
  assert.equal(
    assistantIdFingerprint("ddc68489-aaaa-bbbb-cccc-dddddde1545c"),
    "ddc68489…e1545c"
  );
});

test("an unquoted .env value stops at a trailing comment", () => {
  assert.equal(parseDotEnvValue("-1 # off"), "-1");
  assert.equal(parseDotEnvValue("3000   # every 50 minutes"), "3000");
  assert.equal(parseDotEnvValue("30"), "30");
  assert.equal(parseDotEnvValue('"sk-key#not-a-comment"'), "sk-key#not-a-comment");
  assert.equal(parseDotEnvValue("sk-key#not-a-comment"), "sk-key#not-a-comment");
});

test("-1 disables ambient capture and 0 is rejected", () => {
  assert.equal(
    normalizeAmbientCaptureIntervalSeconds(-1),
    AMBIENT_CAPTURE_DISABLED
  );
  assert.equal(
    normalizeAmbientCaptureIntervalSeconds(-900),
    AMBIENT_CAPTURE_DISABLED
  );
  assert.equal(ambientCaptureIsDisabled(AMBIENT_CAPTURE_DISABLED), true);
  assert.equal(ambientCaptureIsDisabled(30), false);
  assert.equal(normalizeAmbientCaptureIntervalSeconds(30), 30);
  assert.equal(normalizeAmbientCaptureIntervalSeconds(3000), 3000);
  assert.throws(
    () => normalizeAmbientCaptureIntervalSeconds(0),
    /at least 1, or -1 to disable/
  );
});
