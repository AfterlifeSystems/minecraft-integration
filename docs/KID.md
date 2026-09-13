# Play with the avatar

You already have Minecraft Java and Fabric.

1. Copy the host `mods` jars into `.minecraft/mods` (Fabric API + Simple Voice Chat 2.5.28).
2. Launch the **fabric-loader-1.21.1** profile.
3. Multiplayer → the address the host sent (`127.0.0.1:25565` on the same machine).
4. `/tp NeuralNexus` if you need to find the body.

## Talk (this is the Neural Nexus message box)

Press **T** and mention the avatar. That line is sent to Anubis like the web chat box. You should see NeuralNexus reply in chat **and** hear the cloned voice.

```
@NeuralNexus hey isn't this cool?
@NeuralNexus follow me
@NeuralNexus what do you see?
@NeuralNexus help
what can you do?
```

Plain chat without `@NeuralNexus` is ignored, except follow/stop phrases and **what can you do?** `/tp` and other slash commands are server commands, not avatar chat.

## Voice

Hold **push-to-talk** (not the voice-chat settings key) **or** type `@NeuralNexus …`. Both are accepted at any time, the same way Neural Nexus accepts live voice and the text box together. They queue; one does not cancel the other.

The mic / speaker icons are Simple Voice Chat’s HUD, not Neural Nexus. Press **V** → settings → enable on-screen icons / HUD. If those icons are off, you can talk and still see no indicator. NeuralNexus only queues a spoken turn when another player’s name is on the packet **and** the audio crosses a speech level (quiet leftover packets are ignored). Cloned replies play through Simple Voice Chat after `/speak` (that can take several seconds).

## What the avatar can run

These are **not** typed by you. The avatar emits them after Anubis replies.

`!goToPlayer` `!goto` `!follow` `!stop` `!lookAt` `!collectBlocks` `!mineBlock` `!placeBlock` `!craftRecipe` `!smelt` `!equip` `!toss` `!useOn` `!attack` `!sleep` `!eat` `!jump` `!sneak` `!say_chat`

Example: `@NeuralNexus follow me` → NeuralNexus chats a reply, starts following, and plays voice when the clone is ready.
