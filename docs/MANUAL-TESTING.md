# Manual testing: Minecraft body as a latent graph tool

Use this sheet after a build that includes the `act_in_minecraft` work in **f-anubis**, **f-Neural-Nexus-Frontend**, and this companion.

What changed: the play contract is no longer stuffed into the chat `message`. The companion sends the player's words as-is, plus `minecraft_body=true` and a `minecraft_world` snapshot. The API attaches `act_in_minecraft`. Spoken words stay in the reply. Body moves come back on a `minecraft_act` SSE frame. The web app ignores that frame and strips leaked `!commands` if a reply still contains them.

You are checking that the body still plays, that chat stays clean, and that the browser on the same thread does not paint commands.

---

## 0. What you need

- This checkout of `minecraft-integration` (companion + Fabric 1.21.1)
- `wt/f-anubis` running the API that has `act_in_minecraft` (dev stack on this machine is port **9600**)
- `wt/f-Neural-Nexus-Frontend` pointed at that API
- A Neural Nexus account, API key, and personal avatar id
- Minecraft Java Edition **1.21.1** with Fabric Loader, plus the two jars from `mods/` (Fabric API + Simple Voice Chat **2.5.28**)

Agree to the Minecraft EULA before you start Fabric. Bedrock / Microsoft Store / console cannot join.

Install and join notes: [INSTALLATION.md](INSTALLATION.md), [HOST.md](HOST.md), [KID.md](KID.md).

---

## 1. Start the three processes

Do these in order. Leave each one running.

### 1a. API (`f-anubis`)

From `wt/f-anubis`:

```bash
# Confirm the gate is not switched off (empty or true is on)
grep MINECRAFT_BODY_ENABLED .env.dev .env.example
docker compose --env-file .env.dev up
```

You want `MINECRAFT_BODY_ENABLED` unset or `true`. `false` hides the tool and the body will talk but not take graph commands.

API base URL for local testing: `http://127.0.0.1:9600`.

### 1b. Web app (`f-Neural-Nexus-Frontend`)

From `wt/f-Neural-Nexus-Frontend`:

```bash
# Dev file should target the same API
# VITE_NEURAL_NEXUS_API_BASE_URL=http://localhost:9600
npm install
npm run dev
```

Sign in. Open the **same personal avatar** you will put in Minecraft. Leave this tab open.

### 1c. Fabric + companion

From `minecraft-integration`:

```bash
cp .env.example .env   # if you do not already have .env
```

Set at least:

```bash
NEURAL_NEXUS_API_BASE_URL=http://host.docker.internal:9600
API_KEY=your-account-api-key
ASSISTANT_ID=your-personal-avatar-id
```

If you run the companion **without** Docker on the same machine as the API, use `http://127.0.0.1:9600` instead.

```bash
docker compose up --build
# or: npm install && npm start  (Fabric already up via server/start.sh)
```

Companion log must show:

```
Joined … as NeuralNexus
Neural Nexus avatar <fingerprint of ASSISTANT_ID>
```

After you change `ASSISTANT_ID` or the API URL:

```bash
docker compose up -d --force-recreate --no-deps companion
```

Follow companion logs in a second terminal:

```bash
docker compose logs -f companion
```

### 1d. Join the world

1. Launch the **fabric-loader-1.21.1** profile.
2. Multiplayer → `127.0.0.1:25565` on the same machine (or the host address you were given).
3. `/tp NeuralNexus` if you cannot see the body (you must be op).

---

## 2. What “pass” looks like in the logs

On a **play** turn (typed mention, spoken PTT, idle keep-playing), the companion POST must include:

- `message` = only what you said (or empty)
- `minecraft_body=true`
- `minecraft_world` = a snapshot (`position:`, `health:`, inventory, nearby players)

The companion must **not** put `<LATENT_MINECRAFT_BODY>`, `<MINECRAFT_WORLD>`, or `Closed command list:` in `message`.

When the avatar moves, the companion log should show:

```
Running follow []
```

or another closed skill (`goToPlayer`, `collectBlocks`, `goto`, `stop`, …). That line means a `minecraft_act` frame arrived (or the old `!command` fallback still fired).

Spoken reply in game chat and `/speak` audio must be ordinary words. You should never hear or read `!follow()`, `act_in_minecraft`, or “closed command list”.

---

## 3. Checklist

Mark each row as you go. A failed row is a product bug, not “try a different phrase” unless the note says the phrase is local-only.

### A. Typed chat (as-is text)

Stand near NeuralNexus. Press **T**.

| # | You type | Pass |
|---|---|---|
| A1 | `@NeuralNexus hey isn't this cool?` | Reply in chat in the avatar's voice. Cloned audio if the clone is ready. Body does not have to move. Chat is normal sentences only. |
| A2 | `@NeuralNexus where do you work?` / a fact question the avatar should know | Answers as the person. **Zero** body skills in the companion log unless they decided to walk on their own. No `!` lines in chat. |
| A3 | `@NeuralNexus follow me` then walk away | Companion log: `Running follow`. Body pathfinds and stays with you. Chat reply does not contain `!follow()`. |
| A4 | `@NeuralNexus stop` or `stay there` | Companion log: `Running stop`. Body stops. |
| A5 | `@NeuralNexus collect 8 oak logs` (oak nearby) | Companion log: `Running collectBlocks` (or similar). Body walks and chops. Chat stays clean. |
| A6 | `@NeuralNexus go to` your current coordinates (F3) | Companion log: `Running goto`. Body walks there. |
| A7 | `@NeuralNexus look at me` | Body turns to face you. |
| A8 | `what can you do?` or `@NeuralNexus help` | Help lines in chat. **No** API call required for this one. |

**Fail A if:** the reply bubble/chat contains `!goToPlayer`, `<MINECRAFT_WORLD>`, or “Never read commands aloud”. Fail if “follow me” only talks and the body never moves (and the companion log never shows `Running`).

### B. Spoken (push-to-talk)

Simple Voice Chat: bind **push-to-talk** (not **V**; **V** is the settings menu). HUD icons on.

| # | You do | Pass |
|---|---|---|
| B1 | Hold PTT, say “hey, can you hear me?”, release | Companion log: `Spoken utterance queued`. Reply in chat + cloned voice. |
| B2 | Hold PTT, say “follow me”, release | Same as A3: `Running follow`, body walks, speech has no `!` commands. |
| B3 | Hold PTT, say “stop”, release | Body stops. |

**Fail B if:** nothing queues unless you also type, or the spoken reply reads the command list aloud.

### C. Same thread in the web app

The companion reuses one `thread_id` after the first Neural Nexus turn. Copy it from a companion `turn_started` / reply log line if the log prints it.

1. In the web app, open **that same avatar**.
2. If you can open that same conversation, do it. If you cannot find the thread, stay on a new chat with the same avatar (still checks that leaked commands never paint).

| # | You do | Pass |
|---|---|---|
| C1 | After A3 or B2 (a move turn), look at the web transcript | You see the spoken sentence only. No `!follow()`, no `<LATENT_MINECRAFT_BODY>`, no world snapshot dump. |
| C2 | Type `what did I just ask you in Minecraft?` in the web box (same thread) | Avatar can refer to the follow/collect request if it is the same thread. Reply is still clean prose. |
| C3 | Type an ordinary question in the web box while the companion is idle | Web chat works. No Minecraft command list appears in the bubble. |
| C4 | Watch the browser network/SSE if you have it | A `minecraft_act` frame may arrive. The UI does nothing visible with it (no extra bubble, no spoken command list). |

**Fail C if:** the web bubble shows `!goto(…)` or a `<MINECRAFT_WORLD>` block.

### D. Looks (vision) vs play (tool)

| # | You do | Pass |
|---|---|---|
| D1 | `@NeuralNexus what do you see?` | Avatar describes the first-person view (trees, you, blocks). Companion log may show `look_now requested` and a JPEG send. Body may also move; that is fine. |
| D2 | Stand still 30+ seconds with nobody talking | Companion log: `Ambient look sent`. This is a look, **not** a play turn. The ambient POST must **not** send `minecraft_body=true`. The avatar should usually stay quiet. |
| D3 | After a `look_now`, the body can still take a later `@NeuralNexus follow me` | Follow still works. A look resume must not “lose” the Minecraft tool. |

**Fail D if:** after “what do you see?” the next “follow me” only talks and never moves. Fail if ambient looks dump a play prompt into chat.

### E. As-is extra text

| # | You do | Pass |
|---|---|---|
| E1 | `@NeuralNexus follow me and stay near the oak by the stone` | Body follows / walks. The extra place detail is not rewritten into a system prompt. Companion `message` field is exactly that sentence (plus the `@NeuralNexus` handling the companion already does). |
| E2 | If the companion log prints `Minecraft additional as-is text:` | That string matches what the model put on the tool, unchanged (not a cleaned-up paraphrase from the API). |

### F. Gate off (optional, one-time)

Only if you can restart the API.

1. Set `MINECRAFT_BODY_ENABLED=false` in `f-anubis` `.env.dev`.
2. Recreate the API container.
3. `@NeuralNexus follow me`.

**Pass:** avatar still talks. Body does **not** get `minecraft_act` from the graph. Local phrases (`c'mon NeuralNexus`, `stay there`) may still move the body without the API; that is the companion’s local intent path, not the graph tool.

Set the env back to empty/`true` and recreate when you are done.

### G. Negative / leak

| # | You do | Pass |
|---|---|---|
| G1 | Ask something that used to leak (`@NeuralNexus continue`, or wait through an idle tick) | No `<LATENT_MINECRAFT_BODY>` in chat, voice, or the web bubble. |
| G2 | `@NeuralNexus explode the world` / invent a skill | Avatar talks or uses `follow` / `lookAt` as a fallback. Companion does **not** `Running explode…`. |
| G3 | Chat without `@NeuralNexus` (ordinary “hello”) | Ignored, except local follow/stop phrases and **what can you do?** |

---

## 4. Closed command list (do not type these)

The avatar (or the fallback parser) may run only:

`goToPlayer` `goto` `follow` `stop` `lookAt` `collectBlocks` `mineBlock` `placeBlock` `craftRecipe` `smelt` `equip` `toss` `useOn` `attack` `sleep` `eat` `jump` `sneak` `say_chat`

You almost never type `!follow()`. You say “follow me”.

---

## 5. If something fails

| Symptom | Check |
|---|---|
| Companion never joins | Fabric up, `eula.txt`, jars in `server/mods`, `MINECRAFT_SERVER_HOST` |
| Joins but never talks | `NEURAL_NEXUS_API_BASE_URL`, `API_KEY`, `ASSISTANT_ID`; API on 9600; recreate companion after `.env` edits |
| Talks but never walks on “follow me” | API build has `act_in_minecraft`; `MINECRAFT_BODY_ENABLED` not `false`; companion log for `minecraft_act` / `Running follow`; you mentioned `@NeuralNexus` |
| Hears commands read aloud | API/frontend strip failed; note the exact reply text and the companion `Neural Nexus typed reply:` line |
| Web bubble shows `!goto` | Frontend `minecraft_act` ignore / `stripMinecraftBodyLeak` not in this frontend build |
| Voice chat silent | Simple Voice Chat **2.5.28** on server and client; PTT bound; HUD on; `VOICE_HOST` if players are not on localhost |
| `look_now` then body never acts again | Resume must still send `minecraft_body` + `minecraft_world` (this companion build does) |

Unit tests (not a substitute for this sheet):

```bash
# companion
npm test

# API
cd ../wt/f-anubis && make test TEST_FILE=tests/unit_tests/test_minecraft_body.py

# frontend leak strip
cd ../wt/f-Neural-Nexus-Frontend && node --test src/services/stripMinecraftBodyLeak.test.js
```
