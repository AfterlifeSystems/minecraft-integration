# Neural Nexus Minecraft companion

A Mineflayer body for a personal avatar on the **already-running** Neural Nexus API ([anubis](../anubis)). The browser is not used.

```
kid talks in a Fabric 1.21.1 world
  → this companion
  → POST /message and POST /speak on the API that is already up
  → spoken reply + !collectBlocks / !goto / !follow in the world
```

## Setup

1. API is already serving. Copy `.env.example` to `.env` (`NEURAL_NEXUS_API_BASE_URL`, `API_KEY`, `ASSISTANT_ID`).
2. `docs/HOST.md` — Fabric server, copy jars from `mods/` into each `mods` folder.
3. `docs/KID.md` — Windows player copies the same jars and holds **V**.

```bash
npm install
npm test
npm start
```

Contract: `api-1.json`. Request shapes match `Neural-Nexus-Frontend/src/services/avatarService.jsx` (`diarize`, `ambient`, `voice_mode`, `camera_facing=world`).
