# Neural Nexus Minecraft Companion

**Give a Neural Nexus avatar a body in Minecraft.**

Neural Nexus reconstructs a person from their media and serves that person as an A.I. avatar. This repository puts that avatar in a Minecraft Java world as a real player: they walk, look around, answer in their natural voice, and experience the world together by your side.

The companion is a body for an avatar that already exists on [Neural Nexus](https://api.neuralnexus.site). The trained conversations, memories, and voices are all available to be imbued into this Minecraft companion.

The embodied avatar will perform actions, follow commands, respond with trained audio, share facts, have conversations, go on adventures, observe the world, learn facts from their creator, and more!

Talk in chat, command, (`@NeuralNexus follow me`), or hold push-to-talk or hold realtime live audio conversations. The avatar replies as themselves, then moves. Ask who they are and you get a conversation. Ask them to collect oak and they start walking. Ask them to follow and their at your back!

---

## Why this exists

Browser chat is a window. Minecraft is a place.

A Neural Nexus avatar already sees shared screens, hears your voice, and answers as the person you reconstructed. This stack uses those same API routes (`POST /message`, `POST /speak`) so the avatar can:

- **Stand in the world as a player** named `NeuralNexus` (or any offline name you set)
- **Hear you** through Simple Voice Chat, the same way Neural Nexus voice mode hears you
- **See** a first-person look of the world on a timer, and a fresh look when you ask what they see
- **Act** with a closed skill list: follow, stop, walk to coordinates, gather, place, craft on the 2×2 grid, smelt, toss, eat, sleep
- **Keep playing** when the room goes quiet, instead of freezing until the next typed line

One companion process is one avatar in one body. Several people can join the same world and talk to that person.

---

## What you need

| Piece | Why |
|---|---|
| A Neural Nexus account, API key, and avatar id | The body has no brain of its own. If the API is down, the body is mute. |
| Docker (recommended) **or** Node 20+ and Java 21 | Compose starts Fabric + the companion. Native install starts them yourself. |
| Minecraft Java Edition 1.21.1 with Fabric | Bedrock, Microsoft Store, and console editions cannot join this server. |
| Fabric API + Simple Voice Chat **2.5.28** | Same two jars on the server and on every player's `.minecraft/mods`. Version 2.6.x will not join the companion. |

Agree to the [Minecraft EULA](https://www.minecraft.net/eula) before you start the dedicated server.

---

## Install (Docker, recommended)

From a machine that can reach your Neural Nexus API:

```bash
git clone https://github.com/AfterlifeSystems/minecraft-integration.git
cd minecraft-integration
cp .env.example .env
```

Edit `.env` and set the three required fields:

```bash
NEURAL_NEXUS_API_BASE_URL=https://api.neuralnexus.site
API_KEY=your-account-api-key
ASSISTANT_ID=your-avatar-id
```

If Neural Nexus is running on the same machine as Docker (for example port `8124`):

```bash
NEURAL_NEXUS_API_BASE_URL=http://host.docker.internal:8124
```

Start Fabric and the companion:

```bash
docker compose up --build
```

Compose publishes Minecraft TCP `25565` and Simple Voice Chat UDP `24454`. The companion joins the `fabric-server` service. Players type **this machine's** LAN, VPN, or public address. They never type `fabric-server`.

You are up when the companion log shows:

```
Joined fabric-server:25565 as NeuralNexus
Neural Nexus avatar ddc68489…e1545c
```

Follow logs with `docker compose logs -f companion`.

After you change `.env` (`ASSISTANT_ID`, API URL, or keys), recreate the companion. `docker compose restart` keeps the old container environment:

```bash
docker compose up -d --force-recreate --no-deps companion
```

The join line must show the new avatar fingerprint.

Step-by-step host, player, and public-server notes: [docs/INSTALLATION.md](docs/INSTALLATION.md).

---

## Install (without Docker)

Need Java 21 on `PATH` (or `JAVA_HOME`) and Node 20+.

```bash
cp .env.example .env          # fill NEURAL_NEXUS_API_BASE_URL, API_KEY, ASSISTANT_ID
cd server && ./download-server.sh
# Read https://www.minecraft.net/eula then:
echo eula=true > eula.txt
cd ../mods && ./download-jars.sh
cd ../server && ./start.sh    # Windows: .\start.ps1
```

In another terminal, from the repo root:

```bash
npm install
npm test
npm start
```

Leave `MINECRAFT_SERVER_HOST=127.0.0.1` when the companion and Fabric run on the same computer.

Do **not** run `npm audit fix --force`. That command downgrades Mineflayer to 1.x, which cannot join Minecraft 1.21.1.

---

## Play

1. Install Java 21 and [Fabric Loader 1.21.1](https://fabricmc.net/use/installer/). Linux and Windows commands: [docs/KID.md](docs/KID.md).
2. Copy the jars from `mods/` (Fabric API + Simple Voice Chat **2.5.28**) into `.minecraft/mods` (`~/.minecraft/mods` on Linux, `%APPDATA%\.minecraft\mods` on Windows).
3. Launch the **fabric-loader-1.21.1** profile.
4. Multiplayer → the address the host sent (`127.0.0.1:25565` on the same machine).
5. `/tp NeuralNexus` if you need to find the body (you must be op).

Press **T** and mention the avatar. That line is the Neural Nexus message box. You should see a reply in chat **and** hear the cloned voice.

```
@NeuralNexus hey isn't this cool?
@NeuralNexus where do you work?
@NeuralNexus follow me
@NeuralNexus collect 8 oak logs
@NeuralNexus what do you see?
@NeuralNexus help
```

| You do | What happens |
|---|---|
| `@NeuralNexus <sentence>` | Sent to Neural Nexus. Reply in chat + cloned `/speak` audio. Body skills run only if you asked the body to act. |
| Hold **push-to-talk**, speak, release | Same path as voice mode. Bind push-to-talk separately. **V** opens the Simple Voice Chat menu and does not transmit. |
| `what can you do?` or `@NeuralNexus help` | Lists what the body can do. No API call. |
| Chat without `@NeuralNexus` | Ignored, except follow/stop phrases and **what can you do?** |

Typed chat and push-to-talk both queue. One does not cancel the other.

Full phrase list, latent skills, and host commands: [docs/COMMANDS.md](docs/COMMANDS.md). Player join sheet: [docs/KID.md](docs/KID.md).

---

## What the body can do

You talk like a person. The avatar may emit a closed `!` command after the spoken reply. You almost never type those commands yourself.

| You say | The body |
|---|---|
| `follow me` / `c'mon NeuralNexus` / `this way` | Walks with you |
| `stop` / `stay there` / `hold up` | Clears the pathfinder |
| `look at me` | Faces you |
| `go to 100 64 -20` | Walks to those coordinates |
| `collect 8 oak logs` | Finds, walks, digs, repeats |
| `place cobblestone at x y z` | Places a held block |
| `craft sticks` | 2×2 inventory grid only (sticks, planks). No crafting table. |
| `smelt iron` | Uses a nearby furnace if fuel is in inventory |
| `toss me a log` / `eat` / `sleep` | Drops, eats, or sleeps in a nearby bed |

The body **cannot** open chests, trade, fish, fly, farm in a loop, use a 3×3 crafting table, sustain combat, or invent new skills. It cannot join Bedrock. One companion is one avatar.

---

## Environment

Required in `.env`:

| Variable | What it is |
|---|---|
| `NEURAL_NEXUS_API_BASE_URL` | Already-serving API, for example `https://api.neuralnexus.site` or `http://127.0.0.1:8124` |
| `API_KEY` | Account API key (`API-KEY` header) |
| `ASSISTANT_ID` | The personal avatar this body is |

Optional. Blank uses the default.

| Variable | Default | Role |
|---|---|---|
| `MINECRAFT_SERVER_HOST` | `127.0.0.1` | Companion → Fabric. Compose forces `fabric-server`. Not the address players type. |
| `MINECRAFT_SERVER_PORT` | `25565` | Matches `server/server.properties.example` |
| `MINECRAFT_USERNAME` | `NeuralNexus` | Offline name players mention |
| `MINECRAFT_AUTH` | `offline` | Server is `online-mode=false`. Do not use Microsoft login. |
| `USER_TIMEZONE` | (empty) | IANA zone sent as `user_timezone` on `/message` |
| `AMBIENT_CAPTURE_INTERVAL_SECONDS` | `30` | How often the body sends a first-person look |
| `IDLE_PLAY_INTERVAL_SECONDS` | `45` | How often the body asks the API to keep playing when nobody is talking |
| `VOICE_PLAYBACK` | `auto` | Cloned voice through Simple Voice Chat, or `ffplay` on the host. `off` skips playback. |
| `VOICE_HOST` | (empty) | Address **players** use for Simple Voice Chat UDP (VPN or public IP). Never `fabric-server`. |
| `JAVA_MEMORY` | `2G` | Fabric container heap |

These values configure the companion and the Fabric server. They are not what a remote laptop types into Multiplayer.

---

## Let people join from anywhere

The Neural Nexus API already reaches the public internet over HTTPS. Minecraft cannot use that tunnel. Java edition is TCP `25565`. Simple Voice Chat is UDP `24454`.

Keep the companion on the local Fabric process. Prefer a LAN IP, a home router port forward, or a public VPS (EC2). playit.gg Premium is $3/month; their free game list includes Minecraft Java and Simple Voice Chat, but do not treat the tunnel as a $0 default. ngrok can publish TCP join only (`docker compose --profile ngrok up ngrok`); it cannot carry voice UDP. Then set `VOICE_HOST` to the UDP address players should use.

This server is `online-mode=false`. Anyone who has the address can join under any name. Share it with people you intend to play with.

Full steps: [docs/PUBLIC-ACCESS.md](docs/PUBLIC-ACCESS.md) and the public-server section in [docs/INSTALLATION.md](docs/INSTALLATION.md).

---

## Documentation

| Doc | For |
|---|---|
| [docs/INSTALLATION.md](docs/INSTALLATION.md) | Host setup, Docker, native install, AWS / public IP |
| [docs/HOST.md](docs/HOST.md) | Run Fabric on Ubuntu or Windows |
| [docs/KID.md](docs/KID.md) | Player join, chat, and voice |
| [docs/COMMANDS.md](docs/COMMANDS.md) | Every player phrase, latent skill, and host command |
| [docs/PUBLIC-ACCESS.md](docs/PUBLIC-ACCESS.md) | LAN, home port forward, ngrok (TCP only), EC2, playit.gg, why Cloudflare HTTP is the wrong tunnel |
| [mods/README.md](mods/README.md) | Which jars to copy onto each client |

API contract: `api-1.json`. Request shapes match the Neural Nexus web client (`diarize`, `ambient`, `voice_mode`, `camera_facing=world`).

---

## Tests

```bash
npm test
```

CI runs the same suite on Ubuntu and Windows (`.github/workflows/test.yml`).

---

Neural Nexus is the mind. This repository is the body. Install it, mention the avatar, and play with the person you reconstructed.
