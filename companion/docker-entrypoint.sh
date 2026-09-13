#!/usr/bin/env bash
set -euo pipefail

minecraft_host="${MINECRAFT_SERVER_HOST:-fabric-server}"
minecraft_port="${MINECRAFT_SERVER_PORT:-25565}"

echo "Waiting for Fabric at ${minecraft_host}:${minecraft_port}"
attempts=0
while ! bash -c "echo > /dev/tcp/${minecraft_host}/${minecraft_port}" 2>/dev/null; do
  attempts=$((attempts + 1))
  if [[ "${attempts}" -gt 90 ]]; then
    echo "Fabric did not accept connections on ${minecraft_host}:${minecraft_port}"
    exit 1
  fi
  sleep 2
done

exec node companion/src/index.js
