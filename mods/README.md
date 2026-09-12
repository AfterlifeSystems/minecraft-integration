# Jars to copy into each `mods` folder

This is Fabric only. Copy every `.jar` in this directory into:

1. The Fabric server `mods` folder (`server/mods` after `start.sh` / `start.ps1`, which copies these jars for you)
2. The Windows player's `.minecraft/mods` folder

Need at least:

- Fabric API for 1.21.1
- Simple Voice Chat **Fabric 1.21.1-2.5.28** (do not use 2.6.x — the companion voice plugin cannot join that protocol)

Run `mods/download-jars.sh` on the host to fetch those two jars (Fabric Maven, then the official Simple Voice Chat jar). Do not install through the Modrinth or CurseForge apps — copy the same `.jar` files onto the Windows machine's `mods` folder.
