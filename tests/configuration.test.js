import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCompanionConfiguration } from "../companion/src/configuration.js";

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
