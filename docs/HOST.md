# Host (Ubuntu or Windows)

The Neural Nexus API must already be running ([anubis](../../anubis)). This companion only calls that process.

## 1. API

Copy `.env.example` to `.env` and set:

- `NEURAL_NEXUS_API_BASE_URL` — the already-serving API, for example `http://127.0.0.1:8080`
- `API_KEY` — the account API key (`API-KEY` header)
- `ASSISTANT_ID` — the personal avatar
- `MINECRAFT_SERVER_HOST` / `MINECRAFT_SERVER_PORT` — default `127.0.0.1` `25565`
- `MINECRAFT_USERNAME` — offline player name the kid will see
- `MINECRAFT_AUTH` — `offline` for LAN

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

`start.sh` copies `server.properties.example` (offline LAN) on first run. Give the kid the LAN IP and port.

Use **Simple Voice Chat 2.5.28** from `mods/` — not 2.6.x. The companion voice plugin can only join protocol 18.

## 3. Companion

```bash
npm install
npm start
```

The companion joins as a player, sends looks and speech to the API that is already up, speaks with `POST /speak`, and runs `!collectBlocks` / `!goto` / `!follow` in the world.

## 4. Kid machine

Copy the same jars into `.minecraft/mods`. See `docs/KID.md`.
