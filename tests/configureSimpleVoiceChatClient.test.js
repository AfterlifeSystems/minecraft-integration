import { test } from "node:test";
import assert from "node:assert/strict";
import { configureSimpleVoiceChatClient } from "../companion/src/bot/configureSimpleVoiceChatClient.js";

test("voice redirect patches connect and does not throw when packets are missing", () => {
  const connectCalls = [];
  const socketClient = {
    connect() {
      connectCalls.push("original");
    },
    getPackets() {
      throw new Error("Packet registry is not initialized");
    },
  };
  const bot = {
    voicechat: {
      _client: {
        getSocketClient() {
          return socketClient;
        },
      },
    },
  };

  assert.equal(
    configureSimpleVoiceChatClient(bot, { udpHost: "fabric-server" }),
    true
  );
  socketClient.connect();
  assert.deepEqual(connectCalls, ["original"]);
  assert.doesNotThrow(() => socketClient.getPackets().authenticatePacket.send());
});

test("voice redirect is a no-op before the plugin is attached", () => {
  assert.equal(configureSimpleVoiceChatClient({}, { udpHost: "fabric-server" }), false);
});
