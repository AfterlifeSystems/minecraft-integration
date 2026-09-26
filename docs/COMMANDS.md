# Companion command testing checklist

Every command the NeuralNexus companion understands, with an example to type and what to expect. Tick each box as you test.

Watch the companion's log while testing:

```bash
docker compose logs -f companion | grep -v "Companion position"
```

## How to talk to the buddy

The buddy takes commands three ways:

| Way | Example | Goes to Neural Nexus? | Log line to look for |
|---|---|---|---|
| **Typed `!` command** | `!collectBlocks(oak_log, 10)` | No. Runs on the buddy at once and posts the result in chat. | `Typed command from <you> !collectBlocks [...]` then `Running collectBlocks [...]` |
| **Plain phrase (fast path)** | `gather wood` | Yes, but the buddy starts before the reply arrives. | `Local body intent collectBlocks` |
| **Anything else** | `@NeuralNexus build me a dirt hut here` | Yes. The avatar chooses commands through `act_in_minecraft`. | `Avatar act: ...` then `Running ...` |

Rules for typed `!` commands:

- **Two ways to write arguments.** In parentheses: `!goToCoordinates(100, 64, -20)`. Or separated by spaces: `!goToCoordinates 100 64 -20`.
- **Quote a phrase** to keep it as one argument: `!goal "build a small house"`.
- **Names are not case-sensitive.** `!STOP` works like `!stop`.
- **No `@NeuralNexus` needed.** A `!` line needs no mention, and `@NeuralNexus !stop` also works.
- **Who may type them:** if `DIRECT_COMMAND_PLAYERS` is set in `.env`, only those players can. If it is empty, every player can.
- **Unknown names** are answered with `I don't know !<name>. Type !help for the list.`
- **Failures** are posted in chat as `Couldn't finish: <reason>`.

## Natural language equivalents

Almost every `!` command can also be asked for in plain language:

- **Instant phrases.** A fixed set runs on the buddy right away, without waiting for the avatar, and works exactly every time.
- **Everything else goes to the avatar.** Say it with `@NeuralNexus …`, in a whisper, or out loud. The avatar reads the request and sends the matching command through `act_in_minecraft`. Any wording works, but the avatar interprets it, so a vague request can come out differently.

Typed chat without a mention, a `!`, or one of the instant phrases is ignored. "make some planks" alone does nothing; "@NeuralNexus make some planks" works.

### Instant phrases (no `@NeuralNexus` needed when typed)

| Command | Say |
|---|---|
| `follow` | follow me, c'mon NeuralNexus, come on, come here, come with me, this way, over here, keep up, stay with me |
| `stop` (and hold) | stop, stay, wait, freeze, wait here, stay here, stay put, stop following, hold up, hold on, stand still, don't move, don't follow |
| `lookAt player` | look at me, look here |
| `collectBlocks log 8` | gather, gather wood, chop some trees, collect logs, get wood, grab some logs, GatherWoods |
| `collectBlocks <block> 4` | dig (dirt), dig sand, mine stone, mine iron, mine coal, dig gravel, mine diamonds |
| `giveCollected` | give me what you collected, hand over everything, give me your stuff, toss me your loot |

### Through the avatar (examples; any wording that means the same should work)

| Command | Example request |
|---|---|
| `goToPlayer` | "come to me", "go over to Steve" |
| `followPlayer` | "follow Steve", "stay a few blocks behind me" |
| `goToCoordinates` / `goto` | "go to 100 64 -20" |
| `searchForBlock` | "find a crafting table", "go look for iron ore" |
| `searchForEntity` | "find a cow", "go to the nearest villager" |
| `moveAway` | "back off", "move away from here" |
| `goToSurface` | "get out of this cave", "go up to the surface" |
| `digDown` | "dig straight down five blocks" |
| `stay` | "wait here for a minute", "don't move until I say so" |
| `rememberHere` | "remember this spot as base" |
| `goToRememberedPlace` | "go back to base" |
| `lookAtPlayer` / `lookAtPosition` | "look at Steve", "look where I'm looking", "look at 100 64 -20" |
| `collectBlocks` / `mineBlock` | "get me 20 birch logs", "mine one block of stone" |
| `placeBlock` / `placeHere` | "put a dirt block next to you", "place a torch at 100 64 -20" |
| `craftRecipe` | "make some planks", "craft a wooden pickaxe" |
| `smeltItem` | "smelt the raw iron" |
| `clearFurnace` | "empty the furnace" |
| `equip` | "hold your sword" |
| `eat` / `consume` | "eat something", "eat the bread" |
| `givePlayer` | "give me 5 logs", "give Steve your pickaxe" |
| `toss` / `discard` | "drop the dirt", "throw away 10 cobblestone" |
| `putInChest` / `takeFromChest` / `viewChest` | "put the logs in the chest", "take the iron out", "what's in the chest?" |
| `attack` | "kill that zombie", "fight the skeleton", "go hunt a cow" |
| `attackPlayer` | "fight Steve" (only in a game fight) |
| `goToBed` / `sleep` | "go to sleep", "go to bed" |
| `jump` / `sneak` | "jump", "crouch" |
| `useOn` | "shear the sheep", "flip that lever", "use the bucket" |
| `showVillagerTrades` / `tradeWithVillager` | "what does the villager sell?", "buy the emerald trade" |
| `goal` / `endGoal` | "build a small house" (a long job worked on over several turns), "you can stop working on that" |
| `setMode` | "stop picking things up on your own", "start hunting when you're idle" |
| `say_chat` | "say hello to everyone in chat" |
| `startConversation` | "tell Steve we should trade" |

### Typed only (no plain-language equivalent)

- **`!restart` and `!clearChat`** are kept off the avatar's list on purpose: only a player can restart the buddy or reset its conversation.
- **Queries** (`!stats`, `!inventory`, `!nearbyBlocks`, `!entities`, `!craftable`, `!savedPlaces`, `!modes`, `!getCraftingPlan`, `!searchWiki`) have no command the avatar can send, because their answers only go to chat and the avatar could not read them. "where are you?", "what are you carrying?" and "who's near you?" still work: the avatar answers from the world snapshot sent with every turn. A crafting plan or the list of modes is only available as a `!` command.
- **`!newAction`** is not offered at all.

---

**Test setup:** stand 5 to 10 blocks from the buddy in a spot with trees, dirt and stone nearby. Some sections need a chest, a furnace, a crafting table, a bed or a villager; set those up before reaching them.

---

## 1. Help

| ✓ | Type | Expect |
|---|---|---|
| ☐ | `!help` | Chat lists every `!` command name, then an example line. |
| ☐ | `@NeuralNexus help` | The plain-language capability help (seven lines). |
| ☐ | `what can you do` | The same capability help. |
| ☐ | `!bogus` | `I don't know !bogus. Type !help for the list.` |

## 2. Plain phrases (fast path, no `!`)

These start the buddy instantly. The avatar also replies, and if the avatar sends the same command again, it is not run twice.

| ✓ | Say or type | Command that runs | Expect |
|---|---|---|---|
| ☐ | `follow me` / `c'mon NeuralNexus` / `come here` / `this way` / `keep up` / `stay with me` | `follow` | Body walks after you and keeps following. |
| ☐ | `stop following` / `stop followin` / `wait here` / `stay put` / `hold up` / `stand still` / `stop` / `stay` | `stop` | Body stops and **holds**: it does not wander back to you until you say follow. |
| ☐ | `look at me` / `look here` | `lookAt player` | Body turns to face you. **No `look_now` line in the log.** |
| ☐ | `gather wood` / `GatherWoods` / `gather` / `chop some trees` / `get wood` / `can you gather wood` | `collectBlocks log 8` | Body chops the nearest tree of any kind and picks up the logs. |
| ☐ | `dig` | `collectBlocks dirt 4` | Body digs 4 dirt and picks up the drops. |
| ☐ | `mine stone` / `mine iron` / `dig sand` / `mine coal` | `collectBlocks <block> 4` | Body mines that block. Iron also matches deepslate iron ore. |
| ☐ | `give me what you collected` / `hand over everything` / `give me your stuff` | `giveCollected player` | Body walks to you and tosses every stack it carries. |
| ☐ | `did you get wood yesterday?` / `dig a tunnel` | nothing | No `Local body intent` line; left to the avatar. |

## 3. Control

| ✓ | Type | Expect |
|---|---|---|
| ☐ | `!stop` | Stops all movement and any running job (a dig in progress ends quietly, with no failure message). Body holds. |
| ☐ | `!stay(20)` | `Staying here for 20 seconds.` Body holds, then may move again after 20 s. |
| ☐ | `!stay(-1)` | `Staying here until told otherwise.` |
| ☐ | `!clearChat` | `Started a fresh conversation.` The next Neural Nexus turn starts a new thread. |
| ☐ | `!restart` | `Restarting; back in a few seconds.` Body leaves and rejoins about 5 s later. |

## 4. Movement

| ✓ | Type | Expect |
|---|---|---|
| ☐ | `!goToPlayer(UncleEvan1337)` | Walks to within 3 blocks of you, once. `Reached UncleEvan1337.` |
| ☐ | `!goToPlayer(UncleEvan1337, 1)` | Walks to within 1 block. |
| ☐ | `!followPlayer(UncleEvan1337, 4)` | Follows you at about 4 blocks. `Following UncleEvan1337.` |
| ☐ | `!follow` | Follows the nearest player. |
| ☐ | `!goToCoordinates(<x>, <y>, <z>)` | Walks there. `Arrived near x, y, z.` Take coordinates from F3. |
| ☐ | `!goto <x> <y> <z>` | Same as above, with space-separated arguments. |
| ☐ | `!searchForBlock(crafting_table, 32)` | Walks to the nearest crafting table, or says none is within 32. |
| ☐ | `!searchForEntity(cow)` | Walks to the nearest cow. |
| ☐ | `!moveAway(8)` | Moves 8 blocks away from where the buddy stands. |
| ☐ | `!goToSurface` | From a cave or a hole: climbs to the top block. |
| ☐ | `!digDown(3)` | Digs 3 blocks straight down; stops early above lava or water. |

## 5. Places

| ✓ | Type | Expect |
|---|---|---|
| ☐ | `!rememberHere(base)` | `Remembered this spot as base.` |
| ☐ | Walk away, then `!goToRememberedPlace(base)` | Body walks back. `Back at base.` |
| ☐ | `!savedPlaces` | Lists `base at x, y, z`. Saved places survive a reconnect, not a container rebuild. |

## 6. Looking

| ✓ | Type | Expect |
|---|---|---|
| ☐ | `!lookAt(player)` | Faces the nearest player. |
| ☐ | `!lookAtPlayer(UncleEvan1337)` | Faces you. |
| ☐ | `!lookAtPlayer(UncleEvan1337, with)` | Looks the same direction you are looking. |
| ☐ | `!lookAtPosition(<x>, <y>, <z>)` | Faces that block. |

## 7. Gathering and building

| ✓ | Type | Expect |
|---|---|---|
| ☐ | `!collectBlocks(oak_log, 5)` | Chops 5 oak logs and picks them up. Near-miss names fall back to any log (dark oak forest). |
| ☐ | `!collectBlocks(log, 5)` | `log`, `wood` or `tree` means any log type. |
| ☐ | `!collectBlocks(dirt, 3)` | Digs 3 dirt. |
| ☐ | `!collectBlocks(unobtainium, 1)` | Fails with `Unknown block unobtainium.` |
| ☐ | `!mineBlock(stone)` | Mines one stone. |
| ☐ | `!placeHere(dirt)` | Places one dirt beside the buddy (needs dirt in inventory). |
| ☐ | `!placeBlock(dirt)` | Same as above: with no coordinates it places beside the buddy. |
| ☐ | `!placeBlock(dirt, <x>, <y>, <z>)` | Places at that spot; fails if no solid face is next to it. |
| ☐ | Carry only birch logs, then `!placeBlock(birch_planks)` | Crafts planks from the logs first, then places one. |

## 8. Crafting and smelting

| ✓ | Type | Expect |
|---|---|---|
| ☐ | `!craftRecipe(oak_planks, 1)` | `Crafted oak_planks.` (2×2 grid, needs a log.) |
| ☐ | `!craftRecipe(crafting_table, 1)` | Crafts a table from 4 planks. |
| ☐ | `!craftRecipe(wooden_pickaxe, 1)` | Needs the 3×3 grid: walks to a crafting table within 32 blocks, then crafts. Without one: `Cannot craft ... (no crafting table nearby)`. |
| ☐ | `!getCraftingPlan(wooden_pickaxe, 1)` | Lists ingredients with how many the buddy has, and whether a table is needed. |
| ☐ | `!craftable` | Lists what can be crafted right now. |
| ☐ | `!smeltItem(raw_iron, 2)` | Walks to a furnace, adds fuel (coal, charcoal, planks or logs), and smelts 2. |
| ☐ | `!smelt(raw_iron)` | Older single-item smelt. |
| ☐ | `!clearFurnace` | Takes the input, fuel and output out of the nearest furnace. |

## 9. Items

| ✓ | Type | Expect |
|---|---|---|
| ☐ | `!inventory` | `Holding <item>. Inventory: <counts>.` |
| ☐ | `!equip(wooden_pickaxe)` | Holds the pickaxe. |
| ☐ | `!eat` | Eats any food it carries. |
| ☐ | `!consume(bread)` | Eats that specific item. |
| ☐ | `!givePlayer(UncleEvan1337, oak_log, 3)` | Walks to you and tosses 3 logs. |
| ☐ | `!giveCollected(UncleEvan1337)` | Walks to you and tosses everything it carries. |
| ☐ | `!toss(dirt, 2)` | Drops 2 dirt where it stands. |
| ☐ | `!discard(dirt)` | Drops all its dirt (`-1` or no count means all). |

## 10. Chests (place a chest within 32 blocks first)

| ✓ | Type | Expect |
|---|---|---|
| ☐ | `!putInChest(dirt, 2)` | Walks to the chest and stores 2 dirt. |
| ☐ | `!viewChest` | `Chest holds: ...` |
| ☐ | `!takeFromChest(dirt)` | Takes all the dirt back. |

## 11. Combat

| ✓ | Type | Expect |
|---|---|---|
| ☐ | `!attack(zombie)` / `!attack(cow)` | Equips its best sword or axe and fights the nearest one within 24 blocks until the mob is gone. `Defeated the zombie.` |
| ☐ | `!stop` during a fight | The fight ends. |
| ☐ | `!attackPlayer(<friend>)` | Fights that player (test with a willing friend, on a server where PvP is on). |

## 12. Life, use and villagers

| ✓ | Type | Expect |
|---|---|---|
| ☐ | At night, `!goToBed` or `!sleep` | Walks to a bed within 32 blocks and sleeps. |
| ☐ | `!jump` / `!sneak` | A short jump or a crouch. |
| ☐ | `!useOn(shears, sheep)` | Walks to a sheep and shears it. |
| ☐ | `!useOn(hand, lever)` | Flips the nearest lever. |
| ☐ | `!useOn(bucket, nothing)` | Uses the held bucket. |
| ☐ | `!entities` | Lists nearby entities with their ids. Use the id below. |
| ☐ | `!showVillagerTrades(<id>)` | Lists trades as `0: 20 wheat -> 1 emerald; ...`. |
| ☐ | `!tradeWithVillager(<id>, 0, 1)` | Makes trade 0 once (needs the input items). |

## 13. Queries (typed only; the answer is posted in chat)

| ✓ | Type | Expect |
|---|---|---|
| ☐ | `!stats` | Position, dimension, health, hunger and time of day. |
| ☐ | `!inventory` | What it is holding and carrying. |
| ☐ | `!nearbyBlocks` | Block types within 16 blocks. |
| ☐ | `!entities` | Players, mobs and animals within 24 blocks. |
| ☐ | `!craftable` | Items it can craft now. |
| ☐ | `!savedPlaces` | Places saved with `!rememberHere`. |
| ☐ | `!modes` | Every mode, ON or off, with its description. |
| ☐ | `!getCraftingPlan(stick, 4)` | The ingredients needed for 4 sticks. |
| ☐ | `!searchWiki(creeper)` | Says wiki search is not available on this buddy. |

## 14. Autonomy: goals and modes

| ✓ | Type | Expect |
|---|---|---|
| ☐ | `!goal "collect 10 oak logs and craft planks"` | `Working toward: ...`. Every ~8 s while idle the log shows `Goal step N:` and the avatar picks the next commands. It stops after the avatar sends `endGoal`, or after 30 steps. |
| ☐ | `!endGoal` | `Goal ended.` No more goal steps. |
| ☐ | `!setMode(hunting, true)` | `Mode hunting is on.` While idle, the buddy hunts nearby animals. |
| ☐ | `!setMode(hunting, off)` | Turns it back off. |
| ☐ | `!setMode(flying, true)` | Fails with `No mode named flying. Try !modes.` |

Modes, and whether each starts on:

| Mode | Default | What to check |
|---|---|---|
| `self_preservation` | ON | Jumps out of water and lava; eats at 3 hearts or less if it carries food. |
| `unstuck` | ON | Jumps when a walk has not moved for 10 s. |
| `self_defense` | ON | Hits hostile mobs within 4 blocks, even while holding still. |
| `item_collecting` | ON | While idle and not held: walks over nearby drops. |
| `idle_staring` | ON | While idle: turns its head to nearby players and animals. |
| `cowardice` | off | Runs from enemies at under 5 hearts. |
| `hunting` | off | While idle: hunts cows, pigs, chickens, sheep, rabbits. |
| `torch_placing` | off | While idle, with torches and none nearby: places one. |
| `elbow_room` | off | While idle: steps away from a player standing on it. |
| `cheat` | off | Uses `/tp` instead of walking (the buddy must be an operator). |

## 15. Talking to other players and bots

| ✓ | Type | Expect |
|---|---|---|
| ☐ | `!say_chat(hello everyone)` | The buddy says `hello everyone` in chat. |
| ☐ | `!startConversation(<player>, "want to trade?")` | Whispers the message to that player. |
| ☐ | `!endConversation(<player>)` | Confirms the conversation ended. |
| ☐ | `!newAction(anything)` | Refused: runs model-written code and is not offered. |

## 16. Asking the avatar in plain language

These go through Neural Nexus. The log should show `Avatar act: ...` and then `Running ...`. For every row except the last, check that **no `look_now requested` line** appears.

| ✓ | Say or type | Expect the avatar to send |
|---|---|---|
| ☐ | `@NeuralNexus collect some birch logs and make planks` | `collectBlocks(birch_log, …)` then `craftRecipe(birch_planks, …)` |
| ☐ | `@NeuralNexus put a block of dirt next to you` | `placeBlock(dirt)` or `placeHere(dirt)` |
| ☐ | `@NeuralNexus go back to base` (after `!rememberHere(base)`) | `goToRememberedPlace(base)` |
| ☐ | `@NeuralNexus kill that zombie` | `attack(zombie)`. The account must **not** be banned (Minecraft turns are moderated as gameplay). |
| ☐ | `@NeuralNexus wait here for a minute` | `stay(60)` or `stop` |
| ☐ | `@NeuralNexus build a small house` | `goal(...)` or a series of place commands |
| ☐ | `@NeuralNexus what do you see?` | **This one should** show `look_now requested screen`, and the reply describes the Minecraft view without mentioning a webcam. |

## 17. Hold and autonomy regression

| ✓ | Steps | Expect |
|---|---|---|
| ☐ | Say `wait here`, then walk 10 to 20 blocks away and wait 60 s | No `Ambient autonomy: walk toward` line. The buddy stays. |
| ☐ | Then say `follow me` | The hold ends and the buddy follows. |
| ☐ | Start `!collectBlocks(log, 16)`, then walk 10 blocks away | Autonomy does not pull the buddy off the job. |
| ☐ | `!stop` while it is digging | The job ends and no `Couldn't finish` message appears. |
