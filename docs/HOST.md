# Host (Ubuntu or Windows)

The Neural Nexus API must already be running ([anubis](../../anubis)). This companion only calls that process.

## 1. API

Copy `.env.example` to `.env` and set:

- `NEURAL_NEXUS_API_BASE_URL` — the already-serving API, for example `http://127.0.0.1:8080`
- `API_KEY` — the account API key (`API-KEY` header)
- `ASSISTANT_ID` — the personal avatar
- `MINECRAFT_SERVER_HOST` / `MINECRAFT_SERVER_PORT` — default `127.0.0.1` `25565` (companion → local Fabric, not the remote laptop's join address)
- `MINECRAFT_USERNAME` — offline player name the remote player will see
- `MINECRAFT_AUTH` — `offline`
- See the README **Environment** section and `docs/PUBLIC-ACCESS.md`

## 2. Fabric server 1.21.1

Need Java 21 on `PATH`, or set `JAVA_HOME`. The start/download scripts also accept the Cursor Red Hat Java JRE if that is the only Java on the machine.

```bash
cd server
./download-server.sh
# Read https://www.minecraft.net/eula then:
echo eula=true > eula.txt
cd ../mods && ./download-jars.sh
cd ../server && ./start.sh
```

On Windows: `.\start.ps1` after the same `eula.txt` and jars are in `mods/`. The start script copies `../mods/*.jar` into `server/mods`.

`start.sh` copies `server.properties.example` (offline mode) on first run.

Leave the Anubis Cloudflare Tunnel as HTTP-only (`api.neuralnexus.site`). To let anyone in the world join, use a home port forward, playit, or (TCP join only) ngrok, then set Simple Voice Chat `voice_host`. See `docs/PUBLIC-ACCESS.md`. Compose does not start ngrok and does not change the router.

Use **Simple Voice Chat 2.5.28** from `mods/` — not 2.6.x. The companion voice plugin can only join protocol 18.

## 2b. Docker (Fabric + companion)

Anubis is not in this compose file. Fill `.env`, then from the repo root:

```bash
docker compose up --build
```

If Anubis is on the same machine, `NEURAL_NEXUS_API_BASE_URL=http://host.docker.internal:8124`. Compose forces the companion to `fabric-server:25565`. Players still type this machine’s LAN, VPN, or public address — not `fabric-server`.

`docker compose restart companion` does **not** reload `.env`. After changing `ASSISTANT_ID`, run `docker compose up -d --force-recreate --no-deps companion` and check the join line `Neural Nexus avatar …`.

## 3. Companion

```bash
npm install
npm start
```

The companion joins as a player, sends looks and speech to the API that is already up, speaks with `POST /speak`, and runs `!collectBlocks` / `!goto` / `!follow` in the world.

## 4. Kid machine

Copy the same jars into `.minecraft/mods`. See `docs/KID.md`.
