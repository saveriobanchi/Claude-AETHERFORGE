# Testing

`npm run check` runs lint, typecheck and the unit suite. `npm run e2e` runs the
browser smoke tests against the production build. CI runs all of it.

## Unit (Vitest, `tests/unit`)

- **core.test.ts** — new game, harvesting and regrowth, sapling pity, crafting
  (inputs, workbench requirement, capacity), placement rules (ground, floors,
  edge, occupancy), refunds, expansion cost growth, moving buildings, compost,
  kiln fuel, power, manual sieve, night-only generators, pylon fields,
  **item conservation** through dispatchers/conveyors/splitters/depots, belt
  spacing and blocking, sorter routing, harvester automation, wisp logistics,
  discovery ordering, content integrity, determinism.
- **save.test.ts** — exact round-trip of a running world, export/import,
  migration from a v1 save, rejection of garbage/newer saves, tolerance of
  unknown content, offline flow model (caps, efficiency, input exhaustion),
  short absences simulated exactly.
- **playthrough.test.ts** — a scripted player (`tests/bot.ts`) drives the real
  simulation through the public action API from a single tree to the completed
  endgame structure, failing on any softlock, impossible recipe or unreachable
  unlock. It prints the discovery timeline (a pacing report).

## End-to-end (Playwright, `tests/e2e`)

Run on a phone-landscape (touch) profile and a desktop profile: boot without
console errors; gather by touch, build, survive a reload; panels and observe
mode; manifest + service worker + offline reload.

## Manual playtest helpers (`scripts/`)

`play.mjs` (scripted touch playthrough with screenshots), `perf.mjs`,
`shot.mjs`, `focus.mjs`, `make-icons.mjs`.
