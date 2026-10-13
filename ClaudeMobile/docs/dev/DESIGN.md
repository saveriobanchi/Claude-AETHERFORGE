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

- automation ≈ 10 min, conveyors ≈ 20 min, wind ≈ 25 min, iron ≈ 2.8 h,
  aether ≈ 5.4 h, the Great Work discovered ≈ 8.3 h, completed ≈ 17 h.

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
