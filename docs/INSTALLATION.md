# How to install the Neural Nexus Minecraft companion

This guide gets a Fabric 1.21.1 world and a Neural Nexus body running on one host. When you finish, a player can join, type `@NeuralNexus …`, and hear the cloned voice.

Product overview and the short path: [README.md](../README.md). Player join sheet: [KID.md](KID.md). Phrase and skill list: [COMMANDS.md](COMMANDS.md).

## Prerequisites

- A Neural Nexus API that is already serving, plus an account `API_KEY` and `ASSISTANT_ID`
- Docker Engine with Compose **or** Node 20+ and Java 21
- Minecraft Java Edition 1.21.1 (players only). Bedrock cannot join.
- Agreement with the [Minecraft EULA](https://www.minecraft.net/eula)

The companion is not a second API. If Neural Nexus is down, the body is mute.

## 1. Clone and configure

```bash
git clone https://github.com/AfterlifeSystems/minecraft-integration.git
cd minecraft-integration
cp .env.example .env
```

Set these in `.env`:

```bash
NEURAL_NEXUS_API_BASE_URL=https://api.neuralnexus.site
API_KEY=
ASSISTANT_ID=
```

| Situation | `NEURAL_NEXUS_API_BASE_URL` |
|---|---|
| Public Neural Nexus | `https://api.neuralnexus.site` |
| Anubis on this machine, Docker companion | `http://host.docker.internal:8124` |
| Anubis on this machine, native companion | `http://127.0.0.1:8124` (or the port Anubis actually binds) |

Leave the other variables blank to use defaults. Full table: [README.md](../README.md#environment).

These values configure the companion process. They are not the Multiplayer address a remote laptop types.

## 2. Start with Docker (recommended)

```bash
docker compose up --build
```

Compose starts:

- `fabric-server`: Fabric 1.21.1, EULA accepted in the image, ports `25565/tcp` and `24454/udp`
- `companion`: Mineflayer body, waits until Fabric is healthy, joins `fabric-server:25565`

Verification:

```bash
docker compose logs -f companion
```

You should see:

```
Joined fabric-server:25565 as NeuralNexus
Neural Nexus avatar <fingerprint>
```

Players type this machine's LAN IP, VPN IP, or public hostname. Never `fabric-server`.

### After you edit `.env`

Recreate the companion. Restart keeps the old environment.

```bash
docker compose up -d --force-recreate --no-deps companion
```

After you edit companion source:

```bash
docker compose up --build -d --no-deps companion
```

## 3. Start without Docker

Need Java 21 on `PATH` or `JAVA_HOME`. The start scripts also accept the Cursor Red Hat Java JRE if that is the only Java on the machine.

```bash
cd server
./download-server.sh
# Read https://www.minecraft.net/eula then:
echo eula=true > eula.txt
cd ../mods && ./download-jars.sh
cd ../server && ./start.sh
```

On Windows, after the same `eula.txt` and jars: `.\start.ps1`. The start script copies `../mods/*.jar` into `server/mods`. `start.sh` copies `server.properties.example` (offline mode) on first run.

Use **Simple Voice Chat 2.5.28** from `mods/`. Version 2.6.x will not join the companion.

In another terminal, from the repo root:

```bash
npm install
npm test
npm start
```

Set `MINECRAFT_SERVER_HOST=127.0.0.1` when the companion and Fabric are on the same computer.

Do **not** run `npm audit fix --force`. That command downgrades Mineflayer to 1.x, which cannot join Minecraft 1.21.1 and crashes on `InventoryWindow`.

## 4. Player machine

Install Java 21 and Fabric Loader 1.21.1 from the [Fabric installer](https://fabricmc.net/use/installer/), then copy the host `mods` jars (Fabric API + Simple Voice Chat **2.5.28**).

Linux:

```bash
sudo apt update && sudo apt install -y openjdk-21-jre
java -jar fabric-installer-1.1.2.jar client -mcversion 1.21.1 -dir "$HOME/.minecraft"
mkdir -p "$HOME/.minecraft/mods"
cp mods/*.jar "$HOME/.minecraft/mods/"
```

Windows (PowerShell):

```powershell
winget install --id Microsoft.OpenJDK.21 -e
java -jar fabric-installer-1.1.2.jar client -mcversion 1.21.1 -dir "$env:APPDATA\.minecraft"
New-Item -ItemType Directory -Force -Path "$env:APPDATA\.minecraft\mods" | Out-Null
Copy-Item -Path ".\mods\*.jar" -Destination "$env:APPDATA\.minecraft\mods\" -Force
```

Launch **fabric-loader-1.21.1**. Join the address the host sent. Details: [KID.md](KID.md).

## 5. Public server (AWS EC2 or any VPS)

Use this when players should join from anywhere without playit.gg. For a PC behind a home router, use the port-forward or ngrok runbooks in [PUBLIC-ACCESS.md](PUBLIC-ACCESS.md) instead. Compose does not start ngrok and does not change the router.

1. Clone this repo onto the instance (same steps as above).
2. Open the instance firewall **and** the cloud security group:
   - TCP `25565`: Minecraft Java join
   - UDP `24454`: Simple Voice Chat
3. Fill `.env`. If Anubis is not on this instance, keep `NEURAL_NEXUS_API_BASE_URL=https://api.neuralnexus.site`.
4. Set `VOICE_HOST` to the instance **public** IPv4 (or `host:port` if you remap UDP). Players use that address for voice. Never set `VOICE_HOST=fabric-server`.
5. `docker compose up --build -d`
6. Send each player:
   - the two jars from `mods/` (Fabric API + Simple Voice Chat **2.5.28**)
   - `PUBLIC_IP:25565` for Multiplayer

The server is `online-mode=false`. Anyone who has the IP can join under any name. Restrict the security group to people you intend to play with. Do not list the world as a public server.

For a host that should stay behind NAT (no inbound ports), use a game tunnel instead: [PUBLIC-ACCESS.md](PUBLIC-ACCESS.md).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Companion joined but talks as the wrong avatar | Recreate, do not restart: `docker compose up -d --force-recreate --no-deps companion`. Confirm the `Neural Nexus avatar` fingerprint. |
| `InventoryWindow` crash / cannot join 1.21.1 | You ran `npm audit fix --force`. Reinstall from the lockfile: `npm ci`. |
| Player hears nothing | Confirm Simple Voice Chat **2.5.28** on server and client. Confirm UDP `24454` is open (home forward, VPS, or playit). ngrok cannot carry voice. Set `VOICE_HOST` to the address the player can reach. **V** is the settings menu; bind push-to-talk. |
| Chat ignored | Mention the offline name (`@NeuralNexus`) or whisper. Plain chat is dropped on purpose. |
| `docker compose restart` after editing `.env` | That does not reload env. Recreate the companion. |
| Body is mute | Neural Nexus must already be serving. This repo does not start Anubis. |

## Related

- [HOST.md](HOST.md): Ubuntu / Windows Fabric notes
- [PUBLIC-ACCESS.md](PUBLIC-ACCESS.md): home port forward, ngrok, playit.gg, and why the Cloudflare HTTP tunnel cannot carry Minecraft
- [COMMANDS.md](COMMANDS.md): every player phrase and latent skill
