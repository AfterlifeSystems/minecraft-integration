# Neural Nexus Minecraft companion

A Mineflayer body for a personal avatar on the **already-running** Neural Nexus API ([anubis](https://github.com/efwoods/anubis)). The browser is not used. Player phrases, latent `!` skills, voice, and host commands: [docs/COMMANDS.md](docs/COMMANDS.md).

```
kid talks in a Fabric 1.21.1 world
  → this companion
  → POST /message and POST /speak on the API that is already up
  → spoken reply + !collectBlocks / !goto / !follow in the world
```

## Setup

1. API is already serving. Copy `.env.example` to `.env` and fill the fields below.
2. `docs/HOST.md` — Fabric server on the machine that runs the companion.
3. `docs/PUBLIC-ACCESS.md` — publish Fabric to the internet (not the Anubis Cloudflare HTTP tunnel).
4. `docs/KID.md` — a player copies the same jars, joins, then types `@NeuralNexus …` in chat (or holds push-to-talk, not the **V** settings key).

```bash
npm install
npm test
npm start
```

Do **not** run `npm audit fix --force`. That command downgrades Mineflayer to 1.x, which cannot join Minecraft 1.21.1 and crashes on `InventoryWindow`. The remaining `npm audit` findings live inside Mineflayer / Simple Voice Chat and have no compatible fix. Leave them.

```bash
# Fabric + companion (Anubis stays wherever it already runs)
docker compose up --build
```

After changing `.env` (`ASSISTANT_ID`, API URL, keys), do **not** use `docker compose restart`. Restart keeps the old container environment. Recreate the companion:

```bash
docker compose up -d --force-recreate --no-deps companion
```

The join log must show the new `Neural Nexus avatar` fingerprint.

Compose publishes Minecraft `25565` and Simple Voice Chat `24454`. The companion joins the `fabric-server` service, not `127.0.0.1`. If Anubis is on this same machine, set `NEURAL_NEXUS_API_BASE_URL=http://host.docker.internal:8124` in `.env`. If Anubis is already on Cloudflare, keep `https://api.neuralnexus.site`. For a VPN remote player, set `VOICE_HOST` to the host VPN IPv4. Agree to https://www.minecraft.net/eula before `docker compose up` — the Fabric image writes `eula=true` so the dedicated server can start.

Contract: `api-1.json`. Request shapes match `Neural-Nexus-Frontend/src/services/avatarService.jsx` (`diarize`, `ambient`, `voice_mode`, `camera_facing=world`).

## Environment

Required:

- `NEURAL_NEXUS_API_BASE_URL` — the already-serving API, for example `http://127.0.0.1:8124`
- `API_KEY` — the account API key (`API-KEY` header)
- `ASSISTANT_ID` — the personal avatar

The rest are optional. Leave them blank and the companion uses the defaults.

These values are for the **companion process** (the machine that also runs Fabric and talks to Neural Nexus). They are not what the remote laptop types into Minecraft Multiplayer.

When the companion and Fabric server run on the same computer:

```bash
MINECRAFT_SERVER_HOST=127.0.0.1
MINECRAFT_SERVER_PORT=25565
MINECRAFT_USERNAME=NeuralNexus
MINECRAFT_AUTH=offline
USER_TIMEZONE=America/New_York
AMBIENT_CAPTURE_INTERVAL_SECONDS=30
IDLE_PLAY_INTERVAL_SECONDS=45
VOICE_PLAYBACK=auto
```

| Variable | What to put |
|---|---|
| `MINECRAFT_SERVER_HOST` | `127.0.0.1` when the companion and Fabric server are on the same computer. This is not the address the remote laptop uses. |
| `MINECRAFT_SERVER_PORT` | `25565` — matches `server/server.properties.example`. |
| `MINECRAFT_USERNAME` | Offline display name the remote player will see. `NeuralNexus` is fine; change it if you want a different name. |
| `MINECRAFT_AUTH` | `offline` (the server is `online-mode=false`). Do not use Microsoft login for this setup. |
| `USER_TIMEZONE` | IANA zone sent as `user_timezone` on `/message`. Use the remote player's zone, for example `America/New_York`. Blank is allowed. |
| `AMBIENT_CAPTURE_INTERVAL_SECONDS` | How often the bot sends a first-person look. Default `30`. |
| `IDLE_PLAY_INTERVAL_SECONDS` | How often the bot asks the API to keep playing when nobody is talking. Default `45`. |
| `VOICE_PLAYBACK` | `auto` — play cloned voice in Simple Voice Chat if connected, otherwise `ffplay` on the host. `off` skips host/SVC playback (commands still run). |

## Public play (anywhere in the world)

The Anubis API already uses the Cloudflare Tunnel (`api.neuralnexus.site` → local `8124`). **Do not add Minecraft to that tunnel.** Public Cloudflare hostnames are HTTP/HTTPS only. Minecraft Java is TCP `25565`; Simple Voice Chat is UDP `24454`. A vanilla Multiplayer field cannot join `https://api.neuralnexus.site` or a `tcp://` line in `config.yml` the way a browser hits the API.

Keep the companion on `127.0.0.1:25565`. Publish Fabric with a **game** tunnel (playit.gg is the usual choice): TCP to `25565` for join, UDP to `24454` for voice, then set `voice_host` to the UDP address. Full steps: `docs/PUBLIC-ACCESS.md`.

Players install the jars from `mods/` and type the public `hostname:port` the game tunnel prints (`docs/KID.md`).


<!-- https://playit.gg/download/linux -->

# AWS INSTALL
Create clone to aws EC2; open firewall for TCP 25565 and UDP 24454; share the EC2 machine's public IP and ports 
