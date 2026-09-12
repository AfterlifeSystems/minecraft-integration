#!/usr/bin/env bash
# Downloads the official Fabric server launcher for Minecraft 1.21.1.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=find-java.sh
source "$ROOT/find-java.sh"
JAVA_BIN="$(find_java)"
cd "$ROOT"
INSTALLER_URL="https://maven.fabricmc.net/net/fabricmc/fabric-installer/1.0.1/fabric-installer-1.0.1.jar"
curl -fsSL "$INSTALLER_URL" -o fabric-installer.jar
"$JAVA_BIN" -jar fabric-installer.jar server -mcversion 1.21.1 -downloadMinecraft
echo "Fabric 1.21.1 server files are in $ROOT"
