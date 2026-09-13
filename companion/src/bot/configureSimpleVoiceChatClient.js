import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * mineflayer-simplevoice dials UDP 127.0.0.1 when voice_host is empty.
 * In Docker the companion is not the Fabric container, so that socket is refused
 * and the plugin throws "Packet registry is not initialized" (process exit).
 * The companion UDP target is the Minecraft join host. Players still use the
 * server's voice_host (VPN / public IP).
 */
export function configureSimpleVoiceChatClient(bot, { udpHost } = {}) {
  const voiceClient = bot.voicechat?._client;
  if (!voiceClient || typeof voiceClient.getSocketClient !== "function") {
    return false;
  }
  const socketClient = voiceClient.getSocketClient();
  if (!socketClient) {
    return false;
  }
  if (socketClient.neuralNexusVoiceRedirectApplied) {
    return true;
  }

  const originalConnect = socketClient.connect.bind(socketClient);
  socketClient.connect = function connectToCompanionVoiceUdp() {
    if (udpHost) {
      try {
        const storedModule = require("mineflayer-simplevoice/lib/StoredData.js");
        const stored = storedModule.StoredData;
        if (stored?.secretPacketData) {
          stored.secretPacketData.voiceHost = String(udpHost);
        }
      } catch {
        // Plugin layout changed; fall through to the original connect.
      }
    }
    originalConnect();
  };

  const originalGetPackets = socketClient.getPackets.bind(socketClient);
  socketClient.getPackets = function getPacketsOrEmpty() {
    try {
      return originalGetPackets();
    } catch {
      return {
        authenticatePacket: { send() {} },
      };
    }
  };

  socketClient.neuralNexusVoiceRedirectApplied = true;
  return true;
}
