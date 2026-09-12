#!/usr/bin/env bash
# Fetches the two Fabric jars. Not an extra launcher: the files land here, then you copy them.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

FABRIC_API_URL="https://maven.fabricmc.net/net/fabricmc/fabric-api/fabric-api/0.115.6+1.21.1/fabric-api-0.115.6+1.21.1.jar"
# Pin Simple Voice Chat 2.5.28: mineflayer-simplevoice 1.1.1 speaks protocol 18 and AES-CBC.
# 2.6.x is protocol 20 and AES-GCM, so the bot cannot join voice.
SVC_CANDIDATES=(
  "https://cdn.modrinth.com/data/9eGKb6K1/versions/UG3KsGVe/voicechat-fabric-1.21.1-2.5.28.jar"
  "https://github.com/henkelmax/simple-voice-chat/releases/download/fabric-1.21.1-2.5.28/voicechat-fabric-1.21.1-2.5.28.jar"
)

curl -fsSL "$FABRIC_API_URL" -o "fabric-api-0.115.6+1.21.1.jar"

downloaded_voice_chat=0
for candidate_url in "${SVC_CANDIDATES[@]}"; do
  jar_name="$(basename "${candidate_url}")"
  if curl -fL --retry 2 --retry-delay 1 "${candidate_url}" -o "${jar_name}"; then
    downloaded_voice_chat=1
    break
  fi
  rm -f "${jar_name}"
done
if [[ "${downloaded_voice_chat}" -eq 0 ]]; then
  echo "Simple Voice Chat download failed. Place voicechat-fabric-1.21.1-*.jar in this folder by hand."
fi
ls -1 "$ROOT"/*.jar
