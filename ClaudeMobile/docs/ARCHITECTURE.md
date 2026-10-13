# Architecture

```
src/
  core/            pure TypeScript simulation — no DOM, fully unit-tested
    content/       items, recipes, buildings, discoveries, land/islets/endgame data
    state.ts       world state, tile/building indices, seeded RNG, stash
    sim.ts         fixed 20 Hz tick: power, machines, logistics, wisps, nature, islets
    actions.ts     every player command (place, expand, harvest, craft, load, …)
    progression.ts discovery conditions and journal riddles
    offline.ts     time-away model
    save.ts        versioned JSON save, migrations, export/import
  render/
    art/           procedural pixel-art toolkit and every sprite/tile/icon
    world.ts       Pixi scene: chunked terrain, depth-sorted buildings, belts,
                   items, lights, overlays, wisps
    sky.ts         time-of-day sky, sun/moon, stars, parallax clouds and islets
    camera.ts      inertial pan, focal pinch-zoom, eased focus, soft bounds
    effects.ts     pooled particles
    atlas.ts       shelf-packed texture atlas (few draw calls)
  input/gestures.ts  touch-first gestures (mouse emulates a finger)
  ui/              DOM interface (HUD, build tray, panels, journal, settings)
  platform/        IndexedDB storage, Web Audio synth, haptics
  game.ts          loop, modes, input→actions with feedback, persistence
```

## Simulation

- Deterministic fixed-step tick (`TICK = 0.05 s`); the renderer interpolates
  conveyor items between ticks. All randomness uses a seeded RNG stored in the
  save, so identical inputs give identical worlds (tested).
- Topology caches (belt processing order, pylon fields, roost reach, island
  edge set, stash capacity) are rebuilt only when the world changes.
- Conveyors are processed downstream-first so lines compress without gaps;
  each belt holds items as `(item, position)` with minimum spacing.
- Power ("breeze") is a global pool: generation vs demand gives a ratio that
  scales powered machines.
- Depots never block (overflow spills and is counted) so automation cannot
  deadlock when the stash fills.

## Offline progression

Short absences (< 90 s) are simulated exactly. Longer ones use the measured
net automated flow into the stash over the last ~5 minutes of play, at reduced
efficiency and a capped duration; if a consumed input would run out, all
production is assumed to stop at that moment.

## Rendering & performance

- Terrain is rasterised on the CPU per 8×8-tile chunk into one texture each and
  only re-rendered when ground changes (`tileRev`).
- Buildings, items and effects come from one atlas page → heavily batched.
- Off-screen buildings are culled; sprites, items and particles are pooled.
- Night lights are additive sprites, drawn only when it is dark.
- Adaptive quality: if a device cannot hold ~40 fps it switches once to 1×
  resolution, fewer clouds and particles (overridable in Settings).
- Measured: ~2 ms CPU per frame for a mid-size factory; ~0.03 ms per sim tick
  for ~30 machines (linear in machine count).

## Saves

`save` key in IndexedDB (localStorage fallback), autosave every ~20 s and on
hide/close, three rotating backups every 5 minutes, migrations by version,
corrupt-slot recovery, text export/import.
