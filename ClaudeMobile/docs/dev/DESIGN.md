# Aetherforge — design & balance (SPOILERS)

> Developer document. It describes the whole progression. Players — and the
> project owner, who wants to discover the game — should not read this.
> The data itself lives in `src/core/content/*.ts` and is the source of truth.

## Pillars

1. **Create, don't find.** Almost nothing is mined from a pre-made map. Soil is
   rotted from leaves, stone is sifted from soil, metal is sifted from stone.
   Land itself is made from soil.
2. **Hands → gears → wind → aether.** Each era replaces a manual chore with a
   machine, then raises the scale so the question becomes *throughput*.
3. **Space is a resource.** The island starts at 3×3. Plots get pricier with
   size; grass (trees, fiber, dew) and paving (industry) compete; some machines
   need the edge, which makes the island's *shape* matter.
4. **The world tells you.** Machines animate when working, show a status mote
   (green / amber blink / red / blue) and, if a problem persists, a bubble with
   the missing or blocked item.

## Eras and their new idea

| Era | New concept | Key unlocks |
| --- | --- | --- |
| Seed | tapping a regrowing tree | Workbench, Compost Bin |
| Ground | making land from soil | Loam Plot, saplings, tufts → fiber/twine |
| Sifting | resources hidden inside resources | Sifting Frame (tap), pebbles → stone |
| Fire | fuel; recipe choice per machine | Dew Catcher, Clay Tub, Kiln (charcoal/brick/copper) |
| Gears | first automation, outputs facing a direction | Treewright, Conveyor, Depot, Storage Crate |
| Wind | power budget, flagstone floors, wind-driven auto machines | Windmill, Wind Sifter, Sawmill, Stone Press, Dispatcher |
| Iron | deeper chains (stone→gravel→iron) | Millstone, Bellows Furnace, Assembler, Splitter, Sorter, Silo |
| Aether | edge-only generators; the day/night cycle matters | Mist Condenser, Distiller, Star Net (night only) |
| Resonance | spatial buffs, faster logistics, new ground | Resonator, Skystone, Sky Conveyor, Sky Vault, Pylon, Storm Engine |
| Drifters | the world grows by itself | Lodestone Beacon (calls 4 unique islets), Core Drill on islet hearts |
| Alloy & wisps | belt-free logistics | Sunforge Crucible, Wisp Roost, Aether Cell, Lumen Coil |
| The Great Work | a three-stage monument | The Aetherforge |
| Resonance (endless) | rising multi-item requests → sparks → attunements | permanent boosts + cosmetic sky changes |

Discovery conditions are listed in `discoveries.ts`; only the *riddle* of the
next few appears in the journal.

## Core numbers

- Tree: 5 stock, +1 per 5 s; tap → 1 timber + 2 leaves, 20 % fiber, 5 %
  sapling (guaranteed by the 12th harvest).
- Compost: 2 leaves → 1 loam, 8 s. Loam Plot: `3 + 0.4k + 0.0015k²` loam and
  `1 + k/6` timber (k = tiles beyond 9).
- Sifting loam → 2 pebbles (+35 % copper flakes, 4 % sapling).
  Pebbles 4 → stone. Stone → 3 gravel. Gravel → sand (+50 % iron flakes, 12 % copper).
- Kiln fuel: charcoal = 4 units, timber = 1. Bellows Furnace needs breeze 4.
- Windmill: 6 breeze × wind (≈0.5–1.2) × 1.25 at the edge. Storm Engine: 50
  breeze, 1 aether / 10 s, only when windmills fall short.
- Treewright: one harvest per 1.5 s from 8 neighbours (trees and tufts) — a
  full grove of 7 trees roughly matches regrowth.
- Conveyor 1.25 tiles/s, ~3.7 items/s; Sky Conveyor 2.5 tiles/s.
- Stash: 50 of each item; Crate +50, Silo +250, Sky Vault +1000.
- Star Net: 1 stardust / 12 s, night only (30 % of a 10-minute day).
- Islet summons: 20·1.6ⁿ aether + 4·1.6ⁿ crystals; 45 s drift.
- Aetherforge stages: stone 400 / brick 300 / skystone 120 → iron 300 / plate
  150 / mechanism 60 / glass 120 → sunmetal 60 / cell 30 / coil 20 / core 8.
- Resonance level L: 3–5 items, amounts × 1.35^L; each level = 1 spark.
- Offline: ≤ 4 h (+2 h per *Long Dreams* rank) at 50 % (+5 %/rank).

## Pacing (bot-measured)

`tests/unit/playthrough.test.ts` drives an unoptimised scripted player that
uses one-machine-per-cell layouts (no shared conveyors, no pylons, no wisps):

- automation ≈ 10 min, conveyors ≈ 20 min, trade ≈ 20 min, wind ≈ 25 min,
  iron ≈ 2.6 h, hives & orchards ≈ 3.5 h, aether ≈ 5.7 h, the Great Work
  discovered ≈ 7.8 h, completed ≈ 15.7 h (weather on; the bot takes no perks).

A human using dense layouts, pylons and wisps will be faster through the
middle; the endless resonance levels then scale geometrically.

## Design decisions recorded

- Depots never block: overflow spills (tracked) so a full stash can never
  deadlock a mixed-output machine (found by the bot: a Treewright filling the
  stash with timber stopped producing leaves).
- Trees also shed fiber so twine can't become unobtainable if all grass is
  paved (also found by the bot).
- Machine sprites are never mirrored (it would flip the light direction);
  output direction is shown by a brass chevron on the ground.

## Expansion: trade, upgrades, weather, orchards & hives

Goal: more variety without leaving the managerial grind. Every addition is
another reason to scale a production line, not a new minigame.

### Sky Traders (managerial core loop)
- Discovery **Sails** (after *Flow*, 60 items delivered) unlocks the
  **Trading Post** (edge only). Its board always holds 3 **contracts**:
  "deliver N × item". No timers and no expiry: a contract waits until it's done.
- Fill a contract by routing conveyors into the post (only items a contract
  wants are accepted, so lines back up instead of wasting) or by handing items
  over from the stash on the panel.
- Rewards: **Marks** (the trade currency; only earned by playing) and
  reputation. Trade level L raises contract sizes (×(1 + 0.3L)) and Marks.
  A finished contract is replaced after 20 s. **Skip** swaps one contract
  (free, 90 s cooldown) so nothing ever blocks the board.
- Contracts pick from items the player has made before, weighted toward
  recent tiers; orchard/hive goods are worth the most Marks.
- The **Market** (post panel) sells, for Marks: fruit saplings, a hive kit
  (unlocks Apiary), master tools (upgrade levels IV–V), crates of copper /
  iron flakes / stardust (prices rise 25 % per purchase) and trade lanterns
  (decor that glows at night). Nothing in the market is required to finish
  the game; it accelerates and adds variety.

### Machine upgrades (grind sink)
- Discovery **Tinkering** (after *Wind*, 20 gears ever) lets production
  machines (crafters, generators, Treewrights, drills, windmills, hives) be
  upgraded to level III; master tools from the market allow IV–V.
- Each level: +25 % speed (windmills: +25 % breeze) and +50 % buffers.
- Cost to reach level L: the machine's build cost × 2^(L−1); levels IV and V
  also cost 15 / 30 Marks. Removing a machine refunds its build cost only.

### Weather (variety, planning)
- Each in-game day rolls deterministic weather (day 1 is always clear):
  Clear 35 %, Breezy 20 % (wind ×1.25), Calm 12 % (wind ×0.8, trees regrow
  ×1.25), Rain 18 % (dew ×2, trees regrow ×1.5, wind ×0.95), Fog 10 % (mist
  ×2, stardust ×0.75), Starfall 5 % (stardust ×2.5). Tomorrow's weather is
  shown on the clock, so a player can plan around it.
- Averages stay close to 1 so pacing measured by the bot holds.

### Orchards & hives (new branch, trade goods)
- **Fruit Sapling** (market) grows into a **Fruit Tree**: 4 stock, +1 / 8 s,
  each harvest gives 1 apple + 1 leaf; Treewrights harvest them too.
- **Beehive** (Apiary): needs a tree within reach (8 neighbours); makes honey
  every 15 s (+40 % wax), faster with more trees around (×1 + 0.15 per tree,
  max 4). Fruit trees next to a hive yield an extra apple (pollination).
- Recipes: Stone Press 4 apple → cider; Kiln (fuel) 2 apple + 1 honey →
  preserves; Workbench / Assembler 2 wax + 1 twine → 2 candles.
- Apples, honey, wax, cider, candles and preserves are mostly trade goods:
  they make the trade loop varied and give grass tiles a late-game use.

## Biomes

Grass tiles carry a **biome**. New plots are Meadow; the player reshapes grass
into other biomes with *Land* conversions (like Flagstone, but the ground stays
alive, so trees and grass buildings keep working on it). Biomes are variables
on mechanics that already exist, not new minigames — the island's *layout*
becomes a set of microclimates to plan around.

| Biome | Unlock (discovery) | Convert cost | Island tree | Tufts | Effects on machines standing on it |
| --- | --- | --- | --- | --- | --- |
| Meadow | start | 2 loam (restore) | oak: 1 timber + 2 leaves | grass: 2 fiber | hives ×1.2 |
| Marsh | *Wetland* (12 dew) | 3 dew + 2 loam | willow: 1 timber + 3 leaves, more fiber | reeds: 4 fiber | dew ×1.5, compost ×1.5, wind ×0.9, trees regrow ×1.2 |
| Dunes | *Dunes* (6 sand) | 4 sand | palm: 1 timber + 1 leaf, 50 % fiber | dry grass: 1 fiber | dew ×0.5, wind ×1.1, compost ×0.75, hives ×0.9, regrow ×0.9 |
| Frost | *Frost* (6 mist) | 2 mist + 4 pebbles | pine: 2 timber + 1 leaf | frost grass: 1 fiber | wind ×1.25, compost ×0.6, hives ×0.6, regrow ×0.75 |

### Fruit trees (one species per sapling, each with a home biome)

| Fruit | Home | Stock / regrow | Harvest | Uses |
| --- | --- | --- | --- | --- |
| Apple | Meadow | 4 / 8 s | 1 apple + leaf | cider, preserves, basket |
| Cherry | Meadow | 3 / 10 s | 2 cherries | basket, trade |
| Orange | Dunes | 4 / 9 s | 1 orange + leaf | juice (press), basket |
| Date | Dunes | 3 / 12 s | 2 dates | basket, trade |
| Pear | Marsh | 4 / 9 s | 1 pear + leaf | basket, trade |
| Plum | Frost | 3 / 11 s | 2 plums | basket, trade |

- Outside its home biome a fruit tree still grows but regrows at half speed.
  Hives next to fruit trees still add one fruit per harvest (pollination).
- Saplings: the market sells each species once its biome is discovered;
  fruit trees occasionally drop their own sapling.
- **Fruit Basket** (Workbench / Assembler): 2 of each fruit + 1 twine — the
  most valuable trade good; it needs all four biomes on one island.

## Depth & feel: mastery, renown, luck, the codex

The grind should feel rewarding at every scale — the first tap, the first
hundred planks, the hundred-thousandth. Four layers reward volume and choices.

### Item mastery (every item is a long ladder)
- Every item made (harvested, crafted, sifted, generated, drilled) counts
  toward its mastery: ★I–★V at `B, 10B, 100B, 1000B, 10000B` where
  `B = round(40 / (1 + tier/2))` (planks: 40 / 400 / 4k / 40k / 400k).
- Each star: +5 % speed for every machine whose product is that item, and
  renown (10 × star). Stars show beside items in the stash and on panels.

### Renown & perks (a build to plan)
- Renown XP from discoveries (25), mastery stars (10 × ★), contracts (½ of
  the Marks), forge stages (100), resonance levels (50), codex sets (100).
  Level L → L+1 needs `round(80 · 1.22^L)`. Each level = 1 perk point.
  The island banner shows the renown level.
- 12 perks in three branches, 3 ranks each (36 points to max):
  - *Hands*: Green Thumb (trees regrow +10 %), Bountiful (harvest crit
    chance +5 %), Sure Sift (sifting taps +1 roll), Forager (+1 fiber per tuft).
  - *Industry*: Well Oiled (machines +5 %), Swift Belts (conveyors +10 %),
    Deep Cellars (stash +10 %), Lucky Gears (lucky output +1 %).
  - *Commerce*: Haggler (contract Marks +10 %), Good Name (reputation
    +15 %), Bargains (market −5 %), Night Shift (offline +5 % efficiency).
- Respec any time for 5 Marks per point spent.

### Luck & combos (moment-to-moment joy)
- **Lucky output:** every machine cycle has a 2 % (+perk) chance to double
  its output, with a golden sparkle.
- **Bountiful harvest:** hand-gathering a tree has an 8 % (+perk) chance to
  give triple.
- **Gathering combo:** taps within 2 s chain a combo (shown by the finger);
  every 5th tap in a chain gives one extra of the main item.

### Codex (collections)
- Rare gems with tiny chances in existing chains: Topaz (sifting loam,
  0.2 %), Ruby (sifting gravel, 0.15 %), Opal (millstone, 0.25 %), Emerald
  (core drill on an ore heart, 0.5 %). Prized by traders.
- Sets: Gems (4), Fruits (6), Biomes (4 grounds discovered), Wonders
  (forge completed, all islets home). Each completed set: +1 perk point and
  100 renown.

## Chapters, decor and charm

- **Chapters** (`content/chapters.ts`): ten chapters, one active at a time,
  from the first workbench to resonance 3. Each has 1–4 goals (build, make,
  grow, trade, charm, upgrade, biomes, islets, forge, renown, codex) and a
  reward (items, Marks, perk points); chapters 1/3/5/7/9 unlock decor
  patterns. The quest card shows the early tips, then the active chapter's
  next goal; the journal lists the chapter with progress. Old saves catch up
  on load.
- **Decor** (Build › Decor): 20 pieces in five pattern sets — paths, fences,
  hedges, flower beds, benches; cobble paths, stone walls, planters,
  banners, wells; lamp posts, brick arches, fountains, gazebos; skystone
  paths, crystal lamps, statues, star arches; the Forge Monument.
- **Charm** = sum of decor charm (first ten of a kind full, then a quarter).
  Contracts pay +1 % per 5 charm (max +30 %); milestones 20/60/150/300/600/
  1000 give 40 renown each.
- Bot: completes chapters 1–9 and every discovery in ≈16 h (it now widens a
  starving production chain like a player noticing a bottleneck).
