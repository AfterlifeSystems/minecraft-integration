
# INSTRUCTIONS


Launch the Minecraft Launcher once and close it first, so .minecraft exists. Then in PowerShell:

winget install --id Microsoft.OpenJDK.21 -e

# Fabric installer (same jar that is in the repo root)
Invoke-WebRequest -Uri "https://maven.fabricmc.net/net/fabricmc/fabric-installer/1.1.2/fabric-installer-1.1.2.jar" -OutFile "$env:USERPROFILE\Downloads\fabric-installer-1.1.2.jar"
java -jar "$env:USERPROFILE\Downloads\fabric-installer-1.1.2.jar" client -mcversion 1.21.1 -dir "$env:APPDATA\.minecraft"

# The two mod jars
New-Item -ItemType Directory -Force -Path "$env:APPDATA\.minecraft\mods" | Out-Null
Invoke-WebRequest -Uri "https://maven.fabricmc.net/net/fabricmc/fabric-api/fabric-api/0.115.6+1.21.1/fabric-api-0.115.6+1.21.1.jar" -OutFile "$env:APPDATA\.minecraft\mods\fabric-api-0.115.6+1.21.1.jar"
Invoke-WebRequest -Uri "https://cdn.modrinth.com/data/9eGKb6K1/versions/UG3KsGVe/voicechat-fabric-1.21.1-2.5.28.jar" -OutFile "$env:APPDATA\.minecraft\mods\voicechat-fabric-1.21.1-2.5.28.jar"

Get-ChildItem "$env:APPDATA\.minecraft\mods"

Those two URLs are the exact files in the host's mods/ directory, so downloading on the Windows machine and copying from the host give byte-identical jars. If you'd rather copy from the host, that works too — mods/README.md asks you to move the .jar files directly rather than installing through the Modrinth or CurseForge app, because those apps will happily hand you Simple Voice Chat 2.6.x, which this server rejects.

If Java Edition came from the Microsoft Store, add -launcher microsoft_store to the java -jar installer command.

GUI alternative to the installer command: run fabric-installer-1.1.2.jar, tab Client, Minecraft Version 1.21.1, Install. Then Win+R → %appdata%\.minecraft → open mods and paste the two jars in.

2–4. Unchanged

2. In the Minecraft Launcher pick the fabric-loader-1.21.1 profile → Play. The
3. Multiplayer → Direct Connect → nicely-vows.tun.ply.gg:25565.
4. Press V for Simple Voice Chat settings, pick the microphone, bind push-to-talk. V opens settings; it does not transmit.

Confirm it took

Before joining: main menu → Mods lists Fabric API and Simple Voice Chat 2.5.28.

After joining, on the host:

docker logs --tail 30 minecraft-integration-fabric-server-1 2>&1 | grep -i voicechat

Player <name> successfully connected to voice chat means UDP came up through thto <name> with no line after means Windows Firewall or the network is eating the outbound UDP — Windows normally prompts to allow Java on first launch, and dismissing that prompt is the usual cause.


---

# Linux Equivalent

1. Install Fabric Loader 1.21.1, then copy both jars from mods/ into ~/home/user/.minecraft/mods/ — Fabric API 0.115.6+1.21.1 and Simple Voice Chat 2.5.28 exactly (2.6.x will not connect to this server).
2. Launch the fabric-loader-1.21.1 profile.
3. Multiplayer → Direct Connect → nicely-vows.tun.ply.gg:25565.
4. Press V for Simple Voice Chat settings, pick the microphone, bind push-to-talk. V is the settings key, not transmit.

