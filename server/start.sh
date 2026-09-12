#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=find-java.sh
source "$ROOT/find-java.sh"
JAVA_BIN="$(find_java)"
cd "$ROOT"

if [[ ! -f eula.txt ]] || ! grep -q '^eula=true' eula.txt; then
  echo "Read https://www.minecraft.net/eula then write eula=true into server/eula.txt"
  exit 1
fi

if [[ ! -f fabric-server-launch.jar ]]; then
  echo "Run server/download-server.sh first (Fabric 1.21.1)."
  exit 1
fi

mkdir -p mods
shopt -s nullglob
for jar in "$ROOT/../mods"/*.jar; do
  cp -f "$jar" "$ROOT/mods/"
done

if [[ ! -f server.properties && -f server.properties.example ]]; then
  cp server.properties.example server.properties
fi

exec "$JAVA_BIN" -Xmx2G -jar fabric-server-launch.jar nogui
