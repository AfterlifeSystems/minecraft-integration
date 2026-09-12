<!-- 7302122e-8bf7-420f-b313-ed9f3a379990 -->
---
todos:
  - id: "nexus-http"
    content: "Thin HTTP client for the already-serving API: POST /message, /speak, /message/{id}/stop. Copy field names from api-1.json and Neural-Nexus-Frontend avatarService.jsx. No frontend process."
    status: pending
  - id: "play-prompt-skills"
    content: "World snapshot + Minecraft play prompt in message; parse !commands; run Mindcraft-style Mineflayer skills"
    status: pending
  - id: "bot-body"
    content: "Mineflayer join, first-person screen.jpg ambient looks, Simple Voice Chat or host speakers"
    status: pending
  - id: "fabric-docs"
    content: "Fabric 1.21.1 server start scripts; copy Fabric API + Simple Voice Chat jars into the server and client mods folders; kid/host docs"
    status: pending
  - id: "tests"
    content: "Unit tests for FormData builders, command parser, and skills against a fake bot; Windows start.ps1 smoke"
    status: pending
isProject: false
---
# Neural Nexus Minecraft companion (use the serving API)

## What this repo is

A **Node companion** that is a Minecraft body for an avatar that already exists on the running Neural Nexus API.

- API (already serving): [anubis](/home/user/gh/anubis-project/anubis) — `POST /message/{assistant_id}`, `POST /speak`, `POST /message/{assistant_id}/stop`, `POST /transcribe`
- Contract: [api-1.json](/home/user/gh/anubis-project/minecraft-integration/api-1.json)
- How to call it (reference only, do not run): [Neural-Nexus-Frontend/src/services/avatarService.jsx](/home/user/gh/anubis-project/Neural-Nexus-Frontend/src/services/avatarService.jsx)

The browser is **not required**. This companion is a headless client of the same three routes voice mode already uses. No new Anubis endpoints. No frontend build. No OpenAI key in Minecraft.

```
kid talks in Fabric world
  → companion (Mineflayer + play prompt + audio)
  → already-running Neural Nexus
  → reply text + !commands
  → POST /speak + Mineflayer skills
```

**Must work:** he says "get wood and build next to me" and the character chops, crafts, and places while answering in the avatar's voice.

## API we call (from api-1.json)

Auth: header `API-KEY` (or Bearer). Schema: `components.securitySchemes.APIKeyHeader`.

**Talk / see / keep playing** — `POST /message/{assistant_id}` multipart (`Body_message_avatar_message__assistant_id__post`):

| Field | Spoken turn | Ambient look | Idle keep-playing |
|---|---|---|---|
| `message` | play prompt + world snapshot | `""` | play prompt + snapshot + "continue" |
| `files` | 16 kHz WAV utterance | `screen.jpg` | none |
| `diarize` | `true` | | |
| `ambient` | | `true` | |
| `sources` | | `["screen"]` | |
| `camera_facing` | | `world` | |
| `voice_mode` | `true` | `true` | `true` |
| `stream` | `true` | `true` | `true` |
| `thread_id` | reuse from first `turn_started` / `done` | same | same |
| `captured_at` | | ISO time | |

This is exactly `buildSpokenTurnRequest` / `buildAmbientMessageRequest` in the frontend, plus `message` filled with the Minecraft prompt (the frontend leaves `message` empty on spoken turns).

**Voice** — `POST /speak` JSON `{ assistant_id, text }` → MPEG bytes, header `X-Voice-Kind`. Same as `speakText` in the frontend. 409 `voice_not_ready` / `voice_blocked`: play nothing, still run commands.

**Interrupt** — `POST /message/{assistant_id}/stop` with `request_id` from `turn_started`.

`POST /transcribe` is unused if `diarize=true` works (personal avatar). Fallback only.

Parse SSE until `done.content`. Ignore frontend-only frames (`share_stop`, lip-sync, motion).

## What we add so ChatGPT actually plays

The serving API has no Minecraft tools. The extra prompt goes in `message` (no Anubis change):

- You are this person, in Minecraft. Play by emitting Mindcraft commands. Do not read them aloud.
- Live snapshot from Mineflayer: position, biome, time, health, food, inventory, nearby players/blocks.
- Closed command list. After speech, `!goToPlayer`, `!collectBlocks`, `!craftRecipe`, `!placeBlock`, `!goto`, `!follow`, `!stop`, `!attack`, `!smelt`, `!equip`, `!useOn`, `!sleep`, `!lookAt`.

The companion strips `!commands` (and an optional fenced JSON list) before `/speak`, then runs those skills on Mineflayer until done or the kid talks again.

Idle ticks: if nobody is speaking, send another `/message` with the new snapshot so the character keeps playing (same as Mindcraft's loop). Kid speech calls `/stop` and starts a new turn.

Do not enable Mindcraft `!newAction` JS on the host.

## Minecraft body (simple)

- Fabric **1.21.1** dedicated server (scripts in this repo). Offline LAN.
- Kid: Java Edition with Fabric already. Copy the jars from `mods/` into `.minecraft/mods` (and the same jars into the server `mods` folder). That is the whole client install.
- Companion: Mineflayer player, pathfinder, collect/craft/place skills, first-person JPEG as `screen.jpg`, SVC audio in/out or host speakers.

Store edition / Bedrock will not join this server.

## This repo only

```
minecraft-integration/
  companion/          Node: api client, prompt, skills, bot
  server/             Fabric start.sh / start.ps1
  mods/               Fabric API + Simple Voice Chat jars; copy into each mods folder
  docs/KID.md         copy these jars into mods, join the server, hold V
  docs/HOST.md        API-KEY, assistant_id, base URL of the running API
  tests/
  api-1.json          already here
```

Env (`.env.example`, empty values): `NEURAL_NEXUS_API_BASE_URL`, `API_KEY`, `ASSISTANT_ID`, server host/port.

Do not import or start [Neural-Nexus-Frontend](/home/user/gh/anubis-project/Neural-Nexus-Frontend). Do not change [anubis](/home/user/gh/anubis-project/anubis) for v1.

## Tests

- FormData matches `api-1.json` field names (`diarize`, `ambient`, `voice_mode`, `sources`).
- Command parser; each skill invoked on a fake bot.
- Windows: `start.ps1` exists and Node config-validates.

## Out of scope

- Running or shipping the frontend
- New Anubis routes or a Minecraft capability prompt in Anubis
- OpenAI Realtime as the brain
- Custom Fabric Java avatar mod
- Any extra installer or store besides Fabric + dropping jars in `mods`
- LLM-written JavaScript on the host

## Order

1. HTTP client against the live API (message + speak + stop). Prove a text turn with the play prompt returns commands.
2. Parser + skill library + fake-bot tests.
3. Mineflayer join + ambient screenshot + SVC/speakers.
4. Fabric server scripts + jars in `mods/` + kid/host docs (copy jars, no extra installer).
5. Tests on Ubuntu and `windows-latest`.
