# Play with the avatar

Install Minecraft Java, then Fabric Loader **1.21.1** from the [Fabric installer](https://fabricmc.net/use/installer/). Copy the host jars. Join.

Launch Minecraft Java once first so the game folder exists, then close it.

### Linux (Ubuntu)

```bash
sudo apt update && sudo apt install -y openjdk-21-jre
# Download fabric-installer-1.1.2.jar from https://fabricmc.net/use/installer/
java -jar fabric-installer-1.1.2.jar client -mcversion 1.21.1 -dir "$HOME/.minecraft"
mkdir -p "$HOME/.minecraft/mods"
cp /path/to/host/mods/*.jar "$HOME/.minecraft/mods/"
```

### Windows (PowerShell)

```powershell
winget install --id Microsoft.OpenJDK.21 -e
# Download fabric-installer-1.1.2.jar from https://fabricmc.net/use/installer/
java -jar fabric-installer-1.1.2.jar client -mcversion 1.21.1 -dir "$env:APPDATA\.minecraft"
New-Item -ItemType Directory -Force -Path "$env:APPDATA\.minecraft\mods" | Out-Null
Copy-Item -Path "C:\path\to\host\mods\*.jar" -Destination "$env:APPDATA\.minecraft\mods\" -Force
```

`%APPDATA%\.minecraft` is `C:\Users\<you>\AppData\Roaming\.minecraft`. That is the official Minecraft Launcher folder. If you installed Java Edition from the Microsoft Store, add `-launcher microsoft_store` to the Fabric command.

The two jars must be **Fabric API** for 1.21.1 and **Simple Voice Chat 2.5.28**. Do not use 2.6.x.

1. Launch the **fabric-loader-1.21.1** profile in the Minecraft Launcher (you should see **Modded** on the main menu).
2. Multiplayer → the address the host sent (`127.0.0.1:25565` on the same machine).
3. `/teleport @s NeuralNexus` if you need to find the body.

## Talk (this is the Neural Nexus message box)

Press **T** and mention the avatar. That line is sent to Anubis like the web chat box. You should see NeuralNexus reply in chat **and** hear the cloned voice.

```
@NeuralNexus hey isn't this cool?
@NeuralNexus follow me
@NeuralNexus what do you see?
@NeuralNexus help
what can you do?
```

Plain chat without `@NeuralNexus` is ignored, except follow/stop phrases and **what can you do?** `/teleport` and other slash commands are server commands, not avatar chat.

## Voice

Hold **push-to-talk** (not the voice-chat settings key) **or** type `@NeuralNexus …`. Both are accepted at any time, the same way Neural Nexus accepts live voice and the text box together. They queue; one does not cancel the other.

The mic / speaker icons are Simple Voice Chat’s HUD, not Neural Nexus. Press **V** → settings → enable on-screen icons / HUD. If those icons are off, you can talk and still see no indicator. NeuralNexus only queues a spoken turn when another player’s name is on the packet **and** the audio crosses a speech level (quiet leftover packets are ignored). Cloned replies play through Simple Voice Chat after `/speak` (that can take several seconds).

## What the avatar can run

These are **not** typed by you. The avatar emits them after Anubis replies.

`!goToPlayer` `!goto` `!follow` `!stop` `!lookAt` `!collectBlocks` `!mineBlock` `!placeBlock` `!craftRecipe` `!smelt` `!equip` `!toss` `!useOn` `!attack` `!sleep` `!eat` `!jump` `!sneak` `!say_chat`

Example: `@NeuralNexus follow me` → NeuralNexus chats a reply, starts following, and plays voice when the clone is ready.
