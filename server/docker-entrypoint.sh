#!/usr/bin/env bash
set -euo pipefail
ROOT="/minecraft"
cd "$ROOT"

printf 'eula=true\n' > eula.txt

if [[ ! -f server.properties && -f server.properties.example ]]; then
  cp server.properties.example server.properties
fi

if [[ ! -f ops.json && -f ops.json.example ]]; then
  cp ops.json.example ops.json
fi

mkdir -p mods
shopt -s nullglob
for jar in /opt/mod-jars/*.jar; do
  cp -f "$jar" "$ROOT/mods/"
done

mkdir -p config/voicechat
properties_file="config/voicechat/voicechat-server.properties"
if [[ ! -f "${properties_file}" && -f voicechat-server.properties.example ]]; then
  cp voicechat-server.properties.example "${properties_file}"
fi
if [[ -n "${VOICE_HOST:-}" && -f "${properties_file}" ]]; then
  sed -i "s/^voice_host=.*/voice_host=${VOICE_HOST}/" "${properties_file}"
fi

memory="${JAVA_MEMORY:-2G}"
exec java "-Xmx${memory}" -jar fabric-server-launch.jar nogui
