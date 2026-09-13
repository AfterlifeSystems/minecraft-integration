# Neural Nexus Minecraft companion — usage

A companion is a **Minecraft Java / Fabric 1.21.1 body** for one Neural Nexus avatar. Anubis still owns identity, memory, and cloned voice. The body walks, looks, chats, and runs a **closed skill list**. Invented skill names are ignored.

You almost never type `!follow()` yourself. You talk to the avatar; Anubis may emit a latent `!` line after the spoken reply. This document lists every player-facing phrase, every latent skill, and every host command that matters.

Related: `docs/KID.md` (join the world), `docs/HOST.md` (run Fabric), `README.md` (environment).

---

## 1. Talk to the avatar (player)

Press **T**. Mention the offline username (default `NeuralNexus`). That line is the Neural Nexus message box.

```
@NeuralNexus hey isn't this cool?
@NeuralNexus where do you work?
@NeuralNexus describe yourself please
@NeuralNexus follow me
@NeuralNexus stop following
@NeuralNexus what do you see?
@NeuralNexus help
@NeuralNexus what can you do?
```

| You type | What happens |
|---|---|
| `@NeuralNexus <sentence>` | Sent to `POST /message/{assistant_id}` as your words. Reply appears in chat and as cloned `/speak` audio. |
| `@neuralnexus, <sentence>` | Same mention (comma optional, case-insensitive). |
| `/msg NeuralNexus <sentence>` | Whisper counts as a mention. |
| `@NeuralNexus help`, `@NeuralNexus commands`, `@NeuralNexus ?`, or **what can you do?** | Lists what the body can do in plain speech. No API call. |
| `@NeuralNexus` alone | Same help list. |
| Chat without `@NeuralNexus` | Ignored, except follow/stop phrases and **what can you do?** |
| `/tp`, `/gamemode`, other `/` lines | Vanilla **server** commands. The avatar does not read them. |

Plain chat is not a DM. Mentions are required so the body does not treat every nearby sentence as Neural Nexus mail.

Typed chat and push-to-talk both queue. One does not cancel the other. Anubis still runs **one** `/message` at a time; the next waits.

After changing `ASSISTANT_ID` in `.env`, recreate the companion (do not `docker compose restart`):

```bash
docker compose up -d --force-recreate --no-deps companion
```

The join log must show `Neural Nexus avatar` plus the new id fingerprint.

---

## 2. Voice (player)

| Action | Result |
|---|---|
| Hold **Push to Talk**, speak one sentence, release | Audio goes to `/message` with `diarize=true` and `voice_mode=true`. Spoken jobs such as “follow me”, “stop”, and “look at me” should emit the same body skills as typed chat. |
| Live voice / voice activation | Same path, but only if Simple Voice Chat names **another player** on the packet and the PCM crosses a speech level (about 0.5 s, non-silent). Quiet leftovers are logged as `Ignoring quiet voice from …` and are not sent. |
| **V** | Opens the Simple Voice Chat **menu**. That key is not transmit. Bind Push to Talk separately. |
| On-screen mic / speaker icons | Simple Voice Chat HUD. **V** → settings → enable on-screen icons. Neural Nexus does not draw a live waveform in Minecraft. |

There is no duplex “live Neural Nexus call.” One utterance becomes one queued turn, then cloned playback through Simple Voice Chat. Each spoken sentence is posted in chat as that sentence’s audio starts.

Use **Simple Voice Chat Fabric 1.21.1-2.5.28** (protocol 18). Version 2.6.x will not join the companion.

---

## 3. How latent body commands work

Anubis answers **as the person**. After the spoken words, Anubis may emit zero or more lines from the closed list below. The companion strips those lines from chat, then runs them.

Rules the body prompt uses:

- Ordinary questions get **zero** commands (`where do you work?` should not start `!follow`).
- Movement and gathering run only when you asked the body to act (`follow me`, `get some oak`, `come here`).
- Commands are never read aloud.
- Invented names such as `!explodeTheWorld` are dropped.

Accepted shapes (Anubis emits these; you do not need to):

```
On my way.
!follow()
!collectBlocks('oak_log', 8)
```

```
Sure.
```minecraft-actions
{"actions":[{"name":"follow","target":"player"}]}
```
```

Player names default to the nearest other player when the argument is omitted or is `player`.

Block and item names are **Minecraft registry ids**: `oak_log`, `cobblestone`, `wooden_pickaxe`. Not “oak wood.”

---

## 4. Closed skill list

### Movement and attention

| Latent command | Arguments | What the body does | Example things you say |
|---|---|---|---|
| `!goToPlayer(name, range)` | `name` optional; `range` default `2` | Pathfind and stay near that player. | `@NeuralNexus come here` / `@NeuralNexus walk over to UncleEvan1337` |
| `!follow(name)` | `name` optional | Persistent follow at range 2. | `@NeuralNexus follow me` |
| `!goto(x, y, z)` | Block coordinates | Walk to that position (within 1 block). | `@NeuralNexus go to 100 64 -20` |
| `!stop()` | none | Clear the pathfinder goal and movement keys. | `@NeuralNexus stop` / `@NeuralNexus stop following` |
| `!lookAt(name)` | `name` optional | Face that player’s head. | `@NeuralNexus look at me` |

`follow` and `goToPlayer` start a persistent pathfinder goal and return immediately. `goto` waits until the body is near the coordinate.

### Gathering and building

| Latent command | Arguments | What the body does | Example things you say |
|---|---|---|---|
| `!collectBlocks(block, count)` | `block` registry name; `count` default `1` | Find that block within 64, walk, dig, repeat. | `@NeuralNexus get 8 oak logs` |
| `!mineBlock(block)` | `block` | Same as `collectBlocks` with count 1. | `@NeuralNexus mine that cobblestone` |
| `!placeBlock(block, x, y, z)` | Inventory item + integer coordinates | Walk near the spot, place against a solid face. | `@NeuralNexus put cobblestone at 23 80 -130` |

`collectBlocks` stops early if no matching block is left in range. `placeBlock` fails if the item is not in inventory or there is no solid neighbor face.

### Crafting and furnace

| Latent command | Arguments | What the body does | Limits |
|---|---|---|---|
| `!craftRecipe(item, count)` | `item` registry name; `count` default `1` | Craft from the **2×2 inventory grid**. | No crafting table. No 3×3 recipes (no chest, no pickaxe from a table). Sticks, planks, and other 2×2 recipes work if ingredients are in inventory. |
| `!smelt(item)` | `item` or ore name | Walk to a furnace, blast furnace, or smoker within 32; put one input and one fuel; wait up to 30 s; take output. | Needs the item (or `*_ore` / `*_item`) and fuel: `coal`, `charcoal`, `coal_block`, `oak_planks`, or `stick`. |

Examples: `@NeuralNexus craft some sticks` → `!craftRecipe('stick', 4)`. `@NeuralNexus smelt that iron` → `!smelt('iron')` or `!smelt('raw_iron')`.

### Inventory and use

| Latent command | Arguments | What the body does | Example things you say |
|---|---|---|---|
| `!equip(item)` | registry name | Put that inventory item in the hand. | `@NeuralNexus hold your pickaxe` |
| `!toss(item, count)` | `item`; `count` default `1` | Drop that many from inventory. | `@NeuralNexus drop me a log` |
| `!useOn(name)` | player name optional | Look at the player and right-click the held item. | `@NeuralNexus use that on me` |
| `!eat()` | none | Equip food that restores hunger and consume it. | `@NeuralNexus eat something` |

### Combat and body

| Latent command | Arguments | What the body does | Limits |
|---|---|---|---|
| `!attack(name)` | entity username, `name`, or display name | **One** melee hit. | Not a fight loop. No kiting, no bow AI. |
| `!sleep()` | none | Sleep in a bed within 8 blocks. | Fails if no bed or it is not night / storm. |
| `!jump()` | none | Jump for 200 ms. | Gesture only. |
| `!sneak()` | none | Sneak for 400 ms. | Gesture only. |
| `!say_chat(text)` | string | Extra public chat line (on top of the Neural Nexus reply). | Keep short; Minecraft chat is ~256 characters. |

---

## 5. What to say for common jobs

| Goal | Say this | Latent command you should see in logs |
|---|---|---|
| Identity / small talk | `@NeuralNexus where do you work?` | none |
| Walk with you | `@NeuralNexus follow me`, **c'mon NeuralNexus**, **come on**, **this way**, **over here**, or say those on push-to-talk | `Local body intent follow` then `Running follow []` |
| Stop | `@NeuralNexus stop`, **stay there**, **stay put**, **hold up** | `Local body intent stop` then `Running stop []` |
| Face you | `@NeuralNexus look at me` | `Running lookAt ['player']` |
| Walk to coordinates | `@NeuralNexus go to 100, 64, -20` | `Running goto [100, 64, -20]` |
| Gather | `@NeuralNexus collect 8 oak logs` | `Running collectBlocks ['oak_log', 8]` |
| Place | `@NeuralNexus place oak_planks at 10 71 -129` | `Running placeBlock ['oak_planks', 10, 71, -129]` |
| Craft (2×2) | `@NeuralNexus craft sticks` | `Running craftRecipe ['stick', …]` |
| Smelt | `@NeuralNexus smelt iron in that furnace` | `Running smelt ['iron']` |
| Give items | `@NeuralNexus toss me 2 oak_log` | `Running toss ['oak_log', 2]` |
| Eat / sleep | `@NeuralNexus eat` / `@NeuralNexus sleep` | `Running eat []` / `Running sleep []` |

Follow live companion logs (Docker hides output unless you follow):

```bash
docker compose logs -f companion
```

Chat without `@NeuralNexus` logs as `Chat ignored (need @mention):`. Voice logs `Simple Voice Chat connected`, `Voice started from UncleEvan1337`, or `Voice packet ignored`.

Companion logs:

```
Typed chat from UncleEvan1337 where do you work?
Neural Nexus typed reply: I work on Neuralink.
```

A question should **not** be followed by `Running follow` or `Running collectBlocks`. If it is, the body treated a question as a job.

---

## 6. Senses and background loops (not typed)

| Loop | Interval (defaults) | What the companion sends |
|---|---|---|
| Ambient look | `AMBIENT_CAPTURE_INTERVAL_SECONDS` = 30 | First-person JPEG as a live webcam + screen share (`live_shares`). Anubis may speak and/or emit autonomous `!` skills from what it sees. Asking **what do you see?** takes a fresh look (`look_now`) of that same view. |
| Idle play | `IDLE_PLAY_INTERVAL_SECONDS` = 45 | Latent body only. Prefer silence. May continue an obvious current job. |
| World snapshot | every user / idle turn | Position, yaw/pitch, dimension, biome, time, health, food, held item, inventory, nearby players, nearby block names. |

Ambient and idle **skip** while a typed or spoken turn is queued or running.

---

## 7. Host and Docker commands

Run from `minecraft-integration/`. Anubis is **not** in this compose file.

```bash
# First start (Fabric + companion)
docker compose up --build

# After editing companion source
docker compose up --build -d --no-deps companion

# After editing .env (ASSISTANT_ID, API_KEY, API URL)
docker compose up -d --force-recreate --no-deps companion

# Do not use this to pick up .env changes
docker compose restart companion
```

`restart` keeps the old container environment. Recreate. Confirm:

```
Joined fabric-server:25565 as NeuralNexus
Neural Nexus avatar ddc68489…e1545c
```

Without Docker:

```bash
npm install
npm test
npm start
```

Do **not** run `npm audit fix --force` (downgrades Mineflayer to 1.x).

Useful in-game **server** commands (you must be op; `ops.json` loads on Fabric start):

```
/tp NeuralNexus
/tp UncleEvan1337 NeuralNexus
```

`docker attach` does not send console commands unless compose has stdin/tty.

---

## 8. Environment that changes behavior

Required in `.env`: `NEURAL_NEXUS_API_BASE_URL`, `API_KEY`, `ASSISTANT_ID`.

| Variable | Role |
|---|---|
| `ASSISTANT_ID` | Which Neural Nexus avatar the body is. |
| `MINECRAFT_USERNAME` | Offline name players mention (`@NeuralNexus`). |
| `MINECRAFT_SERVER_HOST` | Companion → Fabric. Compose forces `fabric-server`. |
| `VOICE_PLAYBACK` | `auto` = SVC `sendAudio` (else host `ffplay`). `off` = chat and skills only. |
| `VOICE_HOST` | Address **players** use for SVC UDP (VPN / public IP). Never `fabric-server`. |
| `USER_TIMEZONE` | Sent as `user_timezone` on `/message`. |
| `AMBIENT_CAPTURE_INTERVAL_SECONDS` | Ambient look period. |
| `IDLE_PLAY_INTERVAL_SECONDS` | Idle body period. |

---

## 9. Hard limits (not in the skill list)

The body **cannot**:

- Run arbitrary JavaScript or Mindcraft `!newAction`
- Open chests, trade, fish, boat, fly, farm in a loop, use redstone, enchant, or brew
- Use a crafting table (3×3)
- Sustain combat, bow AI, or “build a house from a description”
- See a real framebuffer (raycast JPEG + block names only)
- Join Bedrock, Microsoft Store, or Simple Voice Chat 2.6.x
- Serve as a second API (if Anubis is down, the body is mute)

One companion process = one avatar = one Mineflayer player. Several people can join the same world; they all talk to that one body.

---

## 10. Quick card

```
Talk:     T → @NeuralNexus <words>
Help:     what can you do?  or  @NeuralNexus help
Voice:    hold Push to Talk (not V)
Stop:     @NeuralNexus stop
Follow:   @NeuralNexus follow me
Gather:   @NeuralNexus collect 8 oak_log
Place:    @NeuralNexus place cobblestone at x y z
Craft:    @NeuralNexus craft stick          (2×2 only)
Smelt:    @NeuralNexus smelt iron           (furnace + fuel nearby)
Find:     /tp NeuralNexus                   (op, after Fabric start)
Env:      docker compose up -d --force-recreate --no-deps companion
```
