import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assistantIdFingerprint,
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
